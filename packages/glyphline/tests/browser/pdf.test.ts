import { GlobalWorkerOptions, getDocument, OPS, TextLayer } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/pdf.css';
import { createHighlighter } from '../../src/core/highlighter.ts';
import { wordAtPoint } from '../../src/core/source.ts';
import { geometryFromTextLayer, partBoxes } from '../../src/pdf/geometry.ts';
import { pdfSource } from '../../src/pdf/source.ts';
import pdfUrl from '../fixtures/highlight-stress.pdf?url';

GlobalWorkerOptions.workerSrc = workerUrl;

afterEach(() => {
	document.body.innerHTML = '';
});

async function renderPage(n: number, scale: number) {
	const doc = await getDocument({ url: pdfUrl, fontExtraProperties: true }).promise;
	const page = await doc.getPage(n);
	const vp = page.getViewport({ scale });
	const host = document.createElement('div');
	host.style.cssText = `position:relative;width:${vp.width}px;height:${vp.height}px`;
	host.style.setProperty('--scale-factor', String(scale));
	host.style.setProperty('--total-scale-factor', String(scale));
	const layer = document.createElement('div');
	layer.className = 'textLayer';
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
	svg.setAttribute('preserveAspectRatio', 'none');
	host.append(layer, svg);
	document.body.append(host);
	const tl = new TextLayer({
		textContentSource: await page.getTextContent(),
		container: layer,
		viewport: vp
	});
	await tl.render();
	const base = await pdfSource(page, { OPS: OPS as unknown as Record<string, number> });
	return { doc, page, host, layer, svg, tl, base, scale };
}

describe('pdfSource', () => {
	it('reads words and sentences and places most items from the glyph stream', async () => {
		const { base, doc } = await renderPage(2, 1);
		expect(base.words.length).toBeGreaterThan(50);
		expect(base.sentences.length).toBeGreaterThan(3);
		const placed = base.geometry.source.filter((s) => s === 'glyphs').length;
		const printed = base.geometry.source.filter((s) => s !== null).length;
		expect(placed / printed).toBeGreaterThan(0.8);
		await doc.loadingTask.destroy();
	});

	it('boxes are in page units and independent of the zoom', async () => {
		const a = await renderPage(2, 1);
		const w = a.base.words[10];
		const boxA = a.base.boxes(w.start, w.end, a.svg);
		await a.doc.loadingTask.destroy();
		document.body.innerHTML = '';
		const b = await renderPage(2, 2);
		const boxB = b.base.boxes(w.start, w.end, b.svg);
		expect(boxB).toEqual(boxA);
		expect(b.base.viewBox(b.svg)).toEqual({ x: 0, y: 0, w: b.base.width, h: b.base.height });
		// a click in the middle of the word, in screen px at zoom 2, hits it
		createHighlighter(b.svg, b.base, { animate: false });
		const o = b.svg.getBoundingClientRect();
		const [box] = boxB;
		const hit = wordAtPoint(
			b.base,
			b.svg,
			o.left + (box.x + box.w / 2) * 2,
			o.top + (box.y + box.h / 2) * 2
		);
		expect(hit).toBe(w.index);
		await b.doc.loadingTask.destroy();
	});

	it('maps a selection in the native text layer to a character range', async () => {
		const { base, tl, layer, svg, scale, doc } = await renderPage(2, 1.5);
		const src = base.withTextLayer(tl.textDivs, layer, scale);
		const span = tl.textDivs.find((d) => (d.textContent ?? '').trim().split(' ').length > 2);
		if (!span?.firstChild) throw new Error('no multi-word span');
		const r = document.createRange();
		r.setStart(span.firstChild, 0);
		r.setEnd(span.firstChild, 5);
		document.getSelection()?.removeAllRanges();
		document.getSelection()?.addRange(r);
		const range = src.rangeFromSelection(document.getSelection());
		expect(range).not.toBeNull();
		expect(src.text.slice(range?.start, range?.end)).toBe(span.textContent?.slice(0, 5));
		const hl = createHighlighter(svg, src, { animate: false });
		hl.update({ selection: range });
		expect(svg.querySelector('.gl-selection')?.getAttribute('d')).toMatch(/^M/);
		hl.destroy();
		await doc.loadingTask.destroy();
	});

	it('glyph boxes agree with the native text layer at word edges (median within 2 px)', async () => {
		const { base, tl, layer, scale, doc, svg } = await renderPage(14, 1);
		const range = geometryFromTextLayer(base.pageText, tl.textDivs, layer, scale);
		const dx: number[] = [];
		for (const w of base.words) {
			if (!/^[a-z]{4,}$/.test(w.text)) continue;
			const [g] = base.boxes(w.start, w.end, svg);
			const [r] = partBoxes(base.pageText, range, [
				{ word: w.index, start: w.start, end: w.end, text: w.text }
			]).filter(Boolean) as { x: number }[];
			if (g && r) dx.push(Math.abs(g.x - r.x));
		}
		dx.sort((a, b) => a - b);
		expect(dx.length).toBeGreaterThan(50);
		expect(dx[Math.floor(dx.length / 2)]).toBeLessThan(2);
		await doc.loadingTask.destroy();
	});
});
