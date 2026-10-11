// Node harness for bench.test.ts: loads the stress PDF with the legacy pdf.js build and measures
// every method that runs without a DOM (M1, raw M3, M3+ falling back to M1) on one shared pairing.

import { readFileSync } from 'node:fs';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
	type CharGeometry,
	geometryFromGlyphs,
	geometryFromItems,
	partBoxes,
	withFallback
} from '../src/pdf/geometry.ts';
import { walkGlyphs } from '../src/pdf/glyph-walk.ts';
import { buildPageText, type PageText, type TextItem, wordParts } from '../src/pdf/text-model.ts';
import { type BenchSummary, benchPage, expectedWords, type GroundTruth } from './bench.ts';

export const STRESS_PDF = 'tests/fixtures/highlight-stress.pdf';
export const STRESS_TRUTH = 'tests/fixtures/highlight-stress.groundtruth.json';

export type NodeMethod = 'items' | 'glyphs' | 'hybrid';
export type PageBench = { results: Record<NodeMethod, BenchSummary>; fallbackItems: number };

export async function loadStress() {
	const truth = JSON.parse(readFileSync(STRESS_TRUTH, 'utf8')) as GroundTruth;
	const doc = await getDocument({
		data: new Uint8Array(readFileSync(STRESS_PDF)),
		fontExtraProperties: true,
		verbosity: 0
	}).promise;
	return { truth, doc };
}

type Doc = Awaited<ReturnType<typeof loadStress>>['doc'];
type ToViewport = (x: number, y: number) => [number, number];

/** Anchor of every word part (middle of the x-height on its item), from text content only. */
function partAnchors(page: PageText, toViewport: ToViewport, parts = wordParts(page)) {
	return parts.map((p) => {
		const i = page.charItem[p.start];
		if (i < 0) return null;
		const item = page.items[i];
		const [a, b, c, d, e, f] = item.transform;
		const fh = Math.hypot(a, b) || 1;
		const n = item.str.length || 1;
		const o0 = page.charOffset[p.start];
		const lastItem = page.charItem[p.end - 1];
		const o1 = lastItem === i ? page.charOffset[p.end - 1] + 1 : n;
		const t = ((o0 + o1) / 2 / n) * item.width;
		const ty = 0.3 * fh;
		return toViewport((a * t + c * ty) / fh + e, (b * t + d * ty) / fh + f);
	});
}

export async function benchStressPage(doc: Doc, truth: GroundTruth, n: number): Promise<PageBench> {
	const page = await doc.getPage(n);
	const vp = page.getViewport({ scale: 1 });
	const [content, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
	const items = content.items.filter((i) => 'str' in i) as unknown as TextItem[];
	const text = buildPageText(items);
	const toViewport: ToViewport = (x, y) => vp.convertToViewportPoint(x, y) as [number, number];
	const metricsOf = (f: string) => ({
		ascent: content.styles[f]?.ascent || 0.8,
		descent: content.styles[f]?.descent || -0.2
	});
	const fontOf = (name: string) => {
		const f = page.commonObjs.has(name) ? page.commonObjs.get(name) : null;
		return f
			? { ascent: f.ascent, descent: f.descent, fontMatrix: f.fontMatrix, vertical: f.vertical }
			: undefined;
	};
	const glyphs = walkGlyphs({
		ops,
		OPS: OPS as unknown as Record<string, number>,
		fontOf,
		toViewport
	});
	const items_ = geometryFromItems(text, toViewport, metricsOf);
	const raw = geometryFromGlyphs(text, glyphs, toViewport);
	const hybrid = withFallback(text, { id: 'glyphs', geom: raw }, [{ id: 'items', geom: items_ }]);
	const geoms: Record<NodeMethod, CharGeometry> = {
		items: items_,
		glyphs: raw,
		hybrid: hybrid.geom
	};
	const parts = wordParts(text);
	const anchors = partAnchors(text, toViewport, parts);
	const units = parts.map((p, i) => ({ text: p.text, anchor: anchors[i] }));
	const boxes = Object.fromEntries(
		Object.entries(geoms).map(([k, g]) => [k, partBoxes(text, g, parts)])
	) as Record<NodeMethod, ReturnType<typeof partBoxes>>;
	const expected = expectedWords(truth.pages.find((p) => p.page === n)?.words ?? []);
	const { results } = benchPage(expected, units, boxes, { width: vp.width, height: vp.height });
	return { results, fallbackItems: hybrid.fallbackItems };
}
