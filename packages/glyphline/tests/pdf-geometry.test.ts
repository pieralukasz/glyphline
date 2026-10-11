import { describe, expect, it } from 'vitest';
import { partBoxes, withFallback, wordBoxes } from '../src/pdf/geometry.ts';
import { buildPageText, type TextItem, wordParts } from '../src/pdf/text-model.ts';

/** A line of monospace text: every character 5 units wide at 10 pt. */
const mono = (str: string, x: number, y: number, hasEOL = false, rotate = false): TextItem => ({
	str,
	transform: rotate ? [0, 10, -10, 0, x, y] : [10, 0, 0, 10, x, y],
	width: str.length * 5,
	height: 10,
	fontName: 'f1',
	hasEOL
});

describe('words across a line break', () => {
	it('a hyphenated word keeps one box per line', () => {
		const page = buildPageText([mono('dispro-', 0, 100, true), mono('portionately', 0, 80)]);
		expect(page.words[0].text).toBe('disproportionately');
		const parts = wordParts(page);
		expect(parts.filter((p) => p.word === 0).map((p) => p.text)).toEqual([
			'dispro',
			'portionately'
		]);
		const geom = new Array(page.text.length).fill(null).map((_, i) => {
			const item = page.charItem[i];
			if (item < 0) return null;
			return { x: page.charOffset[i] * 5, y: item === 0 ? 0 : 20, w: 5, h: 10 };
		});
		const boxes = wordBoxes(page, geom);
		expect(boxes[0]).toHaveLength(2);
		expect(boxes[0][1]).toEqual({ x: 0, y: 20, w: 60, h: 10 });
		expect(partBoxes(page, geom)).toHaveLength(parts.length);
	});
});

describe('fallback with provenance', () => {
	it('an item the primary cannot place takes its boxes from the fallback, whole', () => {
		const page = buildPageText([mono('one two', 0, 100), mono('three', 100, 100)]);
		const box = { x: 1, y: 1, w: 1, h: 1 };
		const primary = page.text.split('').map((_, i) => (page.charItem[i] === 0 ? box : null));
		// the primary misses one char of item 1 only partially: still the whole item falls back
		primary[page.itemStart[1]] = box;
		const fallback = page.text.split('').map(() => ({ x: 9, y: 9, w: 1, h: 1 }));
		const h = withFallback(page, { id: 'glyphs', geom: primary }, [
			{ id: 'range', geom: fallback }
		]);
		expect(h.source).toEqual(['glyphs', 'range']);
		expect(h.fallbackItems).toBe(1);
		const s = page.itemStart[1];
		for (let i = s; i < s + 5; i++) expect(h.geom[i]?.x).toBe(9);
	});
});
