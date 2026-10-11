// A TextSource for one PDF page rendered by pdf.js. Word positions come from the page's own glyph
// stream (M3), with the native text layer (M2) and the text items (M1) as per-item fallbacks.

import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextRange } from '../core/segment.ts';
import type { TextSource } from '../core/source.ts';
import type { Box } from '../core/types.ts';
import {
	type CharGeometry,
	geometryFromGlyphs,
	geometryFromItems,
	geometryFromTextLayer,
	type HybridGeometry,
	partBoxes,
	withFallback
} from './geometry.ts';
import { type OperatorList, walkGlyphs } from './glyph-walk.ts';
import {
	buildPageText,
	type PageText,
	type TextItem,
	type WordPart,
	wordParts
} from './text-model.ts';

export type PdfSourceOptions = {
	/** `OPS` from pdfjs-dist (`import { OPS } from 'pdfjs-dist'`): operator ids of your pdf.js build */
	OPS: Record<string, number>;
	/** locale for word and sentence segmentation, default "en" */
	locale?: string;
};

/** A PDF page's text with per-character geometry, in page CSS px at scale 1. */
export interface PdfTextSource extends TextSource {
	readonly page: PDFPageProxy;
	readonly pageText: PageText;
	/** page size at scale 1: the overlay's viewBox */
	readonly width: number;
	readonly height: number;
	/** the geometry drawn, and which method placed each text item */
	readonly geometry: HybridGeometry;
	/** Text items the glyph walk could not place and that took boxes from a fallback. */
	readonly fallbackItems: number;
	/**
	 * Per-character boxes of each method on its own: M1 `items`, M3 `glyphs` (raw, with gaps) and
	 * M2 `range` (null until `withTextLayer`). For comparing methods; `geometry` is what is drawn.
	 */
	readonly methods: {
		readonly items: CharGeometry;
		readonly glyphs: CharGeometry;
		readonly range: CharGeometry | null;
	};
	/**
	 * A copy that also measures the native pdf.js text layer and uses it as the first fallback.
	 * `textDivs` is `TextLayer#textDivs`, `container` the text layer element, `scale` its zoom.
	 */
	withTextLayer(textDivs: HTMLElement[], container: HTMLElement, scale: number): PdfTextSource;
	/**
	 * Character range of a DOM selection made in this page's text layer, or null. Needs
	 * `withTextLayer` first: without the layer there is nothing to select.
	 */
	rangeFromSelection(selection: Selection | null): TextRange | null;
}

type Loaded = {
	page: PDFPageProxy;
	pageText: PageText;
	width: number;
	height: number;
	items: CharGeometry;
	glyphs: CharGeometry;
};

/**
 * Read a page's text and glyph positions. Needs `getDocument({ ..., fontExtraProperties: true })`:
 * without it pdf.js drops the font metrics the glyph walk reads, and words fall back to M1.
 */
export async function pdfSource(
	page: PDFPageProxy,
	options: PdfSourceOptions
): Promise<PdfTextSource> {
	const vp = page.getViewport({ scale: 1 });
	const [content, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
	const items = content.items.filter((i) => 'str' in i) as unknown as TextItem[];
	const pageText = buildPageText(items, { locale: options.locale });
	const styles = content.styles as Record<string, { ascent?: number; descent?: number }>;
	const metricsOf = (f: string) => ({
		ascent: styles[f]?.ascent || 0.8,
		descent: styles[f]?.descent || -0.2
	});
	const fontOf = (name: string) => {
		const f = page.commonObjs.has(name) ? page.commonObjs.get(name) : null;
		return f
			? { ascent: f.ascent, descent: f.descent, fontMatrix: f.fontMatrix, vertical: f.vertical }
			: undefined;
	};
	const toViewport = (x: number, y: number) => vp.convertToViewportPoint(x, y) as [number, number];
	const glyphs = walkGlyphs({
		ops: ops as unknown as OperatorList,
		OPS: options.OPS,
		fontOf,
		toViewport
	});
	return build(
		{
			page,
			pageText,
			width: vp.width,
			height: vp.height,
			items: geometryFromItems(pageText, toViewport, metricsOf),
			glyphs: geometryFromGlyphs(pageText, glyphs, toViewport)
		},
		null,
		[]
	);
}

function build(loaded: Loaded, range: CharGeometry | null, textDivs: HTMLElement[]): PdfTextSource {
	const { pageText } = loaded;
	const fallbacks: { id: 'range' | 'items'; geom: CharGeometry | null }[] = [
		{ id: 'range', geom: range },
		{ id: 'items', geom: loaded.items }
	];
	const geometry = withFallback(pageText, { id: 'glyphs', geom: loaded.glyphs }, fallbacks);
	const parts: WordPart[] = wordParts(pageText);
	const viewBox: Box = { x: 0, y: 0, w: loaded.width, h: loaded.height };

	/** first part whose end is past `start` */
	const firstPart = (start: number) => {
		let lo = 0;
		let hi = parts.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (parts[mid].end <= start) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	};

	const source: PdfTextSource = {
		page: loaded.page,
		pageText,
		width: loaded.width,
		height: loaded.height,
		methods: { items: loaded.items, glyphs: loaded.glyphs, range },
		text: pageText.text,
		words: pageText.words,
		sentences: pageText.sentences,
		geometry,
		fallbackItems: geometry.fallbackItems,
		live: false,
		viewBox: () => viewBox,
		boxes(start, end) {
			// one box per word part (a part never crosses a line), clipped to the range
			const clipped: WordPart[] = [];
			for (let i = firstPart(start); i < parts.length && parts[i].start < end; i++) {
				const p = parts[i];
				const s = Math.max(p.start, start);
				const e = Math.min(p.end, end);
				if (s < e) clipped.push({ ...p, start: s, end: e });
			}
			return partBoxes(pageText, geometry.geom, clipped).filter((b): b is Box => b !== null);
		},
		withTextLayer(divs, container, scale) {
			return build(loaded, geometryFromTextLayer(pageText, divs, container, scale), divs);
		},
		rangeFromSelection(selection) {
			if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
			const r = selection.getRangeAt(0);
			const at = (node: Node, offset: number, edge: 'start' | 'end') => {
				const div = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
				const i = div ? textDivs.indexOf(div as HTMLElement) : -1;
				if (i >= 0 && node.nodeType === Node.TEXT_NODE) return pageText.itemStart[i] + offset;
				// selection edge on an element: the first or last item inside the range
				const inside = textDivs.map((d, k) => [d, k] as const).filter(([d]) => r.intersectsNode(d));
				const pick = edge === 'start' ? inside[0] : inside[inside.length - 1];
				if (!pick) return -1;
				const k = pick[1];
				return edge === 'start'
					? pageText.itemStart[k]
					: pageText.itemStart[k] + pageText.items[k].str.length;
			};
			const start = at(r.startContainer, r.startOffset, 'start');
			const end = at(r.endContainer, r.endOffset, 'end');
			return start >= 0 && end > start ? { start, end } : null;
		}
	};
	return source;
}
