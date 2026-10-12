import { describe, expect, it } from 'vitest';
import {
	groupRuns,
	mergeLines,
	morphShape,
	outlinePath,
	sentenceShape,
	shapePath,
	stretchBox,
	wordPath
} from '../src/core/outline.ts';

const w = (x: number, y: number, w = 30, h = 10) => ({ x, y, w, h });

describe('wordPath', () => {
	it('uses concentric circular corners inside the default sentence boundary without removing the inset', () => {
		const b = w(10, 100, 60, 22);
		expect(wordPath(b)).toBe(shapePath(sentenceShape([b], { pad: 1.5 }), 4.5));
		expect(wordPath(b, { pad: 4, radius: 2 })).toBe(shapePath(sentenceShape([b], { pad: 4 }), 2));
	});
});

describe('mergeLines', () => {
	it('merges the words of one line into one box', () => {
		const lines = mergeLines([w(10, 100), w(45, 100), w(80, 100)]);
		expect(lines).toEqual([{ x: 10, y: 100, w: 100, h: 10 }]);
	});

	it('keeps a subscript or a symbol from a smaller font on the same line', () => {
		const lines = mergeLines([w(10, 100), w(42, 104, 6, 6), w(50, 100)]);
		expect(lines).toHaveLength(1);
		expect(lines[0].x).toBe(10);
		expect(lines[0].w).toBe(70);
	});

	it('splits at a column gap wider than ~1.5 em', () => {
		const lines = mergeLines([w(10, 100), w(45, 100), w(200, 100), w(235, 100)]);
		expect(lines).toHaveLength(2);
	});

	it('keeps separate lines separate', () => {
		const lines = mergeLines([w(10, 100), w(10, 115)]);
		expect(lines).toHaveLength(2);
	});
});

describe('mergeLines on vertical text', () => {
	it('merges stacked words of a rotated line into one tall box', () => {
		const v = (y: number, h: number) => ({ x: 418, y, w: 12, h });
		const lines = mergeLines([v(260, 18), v(281, 35), v(319, 10), v(331, 21), v(355, 27)]);
		expect(lines).toEqual([{ x: 418, y: 260, w: 12, h: 122 }]);
		expect(groupRuns([v(260, 18), v(281, 35), v(319, 10)])).toHaveLength(1);
	});
});

describe('groupRuns', () => {
	it('chains consecutive lines of one column into one run and closes the gap', () => {
		const runs = groupRuns([w(10, 100), w(45, 100), w(10, 114), w(45, 114)]);
		expect(runs).toHaveLength(1);
		expect(runs[0]).toHaveLength(2);
		expect(runs[0][0].y + runs[0][0].h).toBeCloseTo(runs[0][1].y);
	});

	it('starts a new run for a second column', () => {
		const runs = groupRuns([w(10, 100), w(10, 114), w(300, 100), w(300, 114)]);
		expect(runs).toHaveLength(2);
	});
});

describe('outlinePath', () => {
	it('draws one closed path per run, not one per word', () => {
		const d = outlinePath([w(10, 100), w(45, 100), w(80, 100), w(10, 114), w(45, 114)]);
		expect((d.match(/Z/g) ?? []).length).toBe(1);
		expect(d.startsWith('M')).toBe(true);
	});

	// the windward sentence: starts mid-line, one full line, ends early on the third line
	const windward = [
		{ x: 130, y: 10, w: 370, h: 12 },
		{ x: 15, y: 30, w: 485, h: 12 },
		{ x: 15, y: 50, w: 105, h: 12 }
	];

	/** straight segments of a path (the arcs only round the corners). */
	function segments(d: string) {
		const pts: [number, number][] = [];
		for (const m of d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)) pts.push([+m[2], +m[3]]);
		const ends: [number, number][] = [];
		for (const m of d.matchAll(/A[\d.]+ [\d.]+ 0 0 [01] (-?[\d.]+) (-?[\d.]+)/g))
			ends.push([+m[1], +m[2]]);
		// each L starts at the previous arc's end
		return pts.slice(1).map((p, i) => [ends[i], p] as const);
	}

	it('has no slanted edges where lines meet, only horizontal and vertical ones', () => {
		const d = outlinePath(windward);
		for (const [a, b] of segments(d)) {
			const horizontal = Math.abs(a[1] - b[1]) < 0.01;
			const vertical = Math.abs(a[0] - b[0]) < 0.01;
			expect(horizontal || vertical).toBe(true);
		}
	});

	it('does not zigzag: every corner is a real step of the outline', () => {
		// 3 lines of different extent: 8 corners (start step, two ends of the full line, end step)
		expect((outlinePath(windward).match(/A/g) ?? []).length).toBe(8);
	});

	it('aligns the entire near-equal edge cluster, not just the last pair', () => {
		const shape = sentenceShape([
			w(10.003, 10, 169.1106, 12),
			w(10.002, 25, 166.2595, 12),
			w(10.001, 40, 169.1143, 12),
			w(10, 55, 169.1197, 12),
			w(10, 70, 169.1152, 12),
			w(10, 85, 169.1151, 12),
			w(10, 100, 161.9138, 12),
			w(10, 115, 169.1233, 12),
			w(10, 130, 64.7492, 12)
		]);
		const run = shape[0];
		expect(new Set(run.map((b) => b.x))).toEqual(new Set([8]));
		expect(new Set(run.slice(0, 6).map((b) => b.x + b.w))).toEqual(new Set([181.1197]));
		// Real indentation and the short final line must not become a bounding rectangle.
		expect(run[6].x + run[6].w).toBeCloseTo(173.9138);
		expect(run[8].x + run[8].w).toBeCloseTo(76.7492);
		expect((shapePath(shape).match(/A/g) ?? []).length).toBe(10);
	});

	it('does not turn sub-pixel steps into full-radius semicircles when snapping is disabled', () => {
		const shape = sentenceShape([w(10, 10, 100, 12), w(10, 25, 100.001, 12)], { snap: 0 });
		// Both ends serialize to x=112.00: one rectangle, not a false corner on its right edge.
		expect((shapePath(shape).match(/A/g) ?? []).length).toBe(4);
	});

	it('bounds snap clusters so a gradual rag is not flattened', () => {
		const boxes = [100, 103, 106, 109].map((width, i) => w(10, 10 + i * 15, width, 12));
		const run = sentenceShape(boxes)[0];
		expect(run.map((b) => b.x + b.w)).toEqual([115, 115, 121, 121]);
		expect(sentenceShape(boxes, { snap: 0 })[0].map((b) => b.x + b.w)).toEqual([
			112, 115, 118, 121
		]);
	});

	it('snaps within each column without changing source boxes or the word cursor', () => {
		const boxes = [w(10, 10, 100), w(10, 25, 102), w(200, 10, 100), w(200, 25, 98)];
		const original = structuredClone(boxes);
		const word = wordPath(boxes[0]);
		const shape = sentenceShape(boxes);
		expect(shape).toHaveLength(2);
		expect(shape.map((run) => run.map((b) => b.x + b.w))).toEqual([
			[114, 114],
			[302, 302]
		]);
		expect(boxes).toEqual(original);
		expect(wordPath(boxes[0])).toBe(word);
		expect((shapePath(shape).match(/Z/g) ?? []).length).toBe(2);
	});

	it.each([0.001, -0.001, 0.009, -0.009])('keeps tiny edge steps orthogonal (%s)', (delta) => {
		const d = outlinePath([w(10, 10, 100, 12), w(10, 25, 100 + delta, 12)], { snap: 0 });
		for (const [a, b] of segments(d)) {
			expect(a[0] === b[0] || a[1] === b[1]).toBe(true);
		}
		expect(d).not.toMatch(/NaN|Infinity/);
	});

	it('aligns justified line ends that differ by a fraction of a pixel', () => {
		const shape = sentenceShape([
			{ x: 15, y: 10, w: 485.4, h: 12 },
			{ x: 15.3, y: 30, w: 484.6, h: 12 }
		]);
		const [a, b] = shape[0];
		expect(a.x).toBe(b.x);
		expect(a.x + a.w).toBeCloseTo(b.x + b.w);
		// two equal lines are one rounded rectangle: 4 corners
		expect((shapePath(shape).match(/A/g) ?? []).length).toBe(4);
	});
});

describe('morphShape', () => {
	it('keeps the lines touching while one sentence turns into the next', () => {
		const from = sentenceShape([w(100, 100, 200), w(10, 114, 150)]);
		const to = sentenceShape([w(160, 114, 140), w(10, 128, 290), w(10, 142, 60)]);
		const mid = morphShape(from, to)?.(0.5);
		expect(mid?.[0]).toHaveLength(3);
		const run = mid?.[0] ?? [];
		for (let i = 0; i < run.length - 1; i++) {
			expect(run[i].y + run[i].h).toBeCloseTo(run[i + 1].y);
		}
		expect(morphShape(from, to)?.(1)).toEqual(to);
	});

	it('stretches along the line instead of sliding when the next sentence is on the same line', () => {
		const from = sentenceShape([w(10, 100, 200)]);
		const to = sentenceShape([w(240, 100, 150)]);
		const half = morphShape(from, to)?.(0.5)?.[0][0];
		expect(half?.x).toBeLessThan((from[0][0].x + to[0][0].x) / 2);
		expect(half?.w).toBeLessThanOrEqual(Math.max(from[0][0].w, to[0][0].w) + 14);
		expect(morphShape(from, to)?.(1)).toEqual(to);
	});

	it('refuses to pair a one-column sentence with a two-column one', () => {
		const one = sentenceShape([w(10, 100)]);
		const two = sentenceShape([w(10, 100), w(300, 100)]);
		expect(morphShape(one, two)).toBeNull();
	});
});

describe('stretchBox', () => {
	const a = { x: 10, y: 100, w: 30, h: 10 };
	const b = { x: 80, y: 100, w: 40, h: 10 };
	it('leads with the forward edge but bounds expansion to one line height', () => {
		const half = stretchBox(a, b, 0.5);
		expect(half.x).toBeLessThan(45);
		expect(half.x + half.w).toBeGreaterThan(80);
		expect(half.w).toBeLessThanOrEqual(50);
		expect(stretchBox(a, b, 1)).toEqual(b);
	});
	it('stretches to the left when the next word is earlier on the line', () => {
		const half = stretchBox(b, a, 0.5);
		expect(half.x).toBeLessThan(45);
		expect(half.w).toBeLessThanOrEqual(50);
	});
});

describe('mergeLines bridging', () => {
	it('merges two line boxes that a later box connects', () => {
		// [0..10] and [50..60] are 40 apart (> 1.5 em); [20..40] bridges them to gaps of 10
		const lines = mergeLines([w(0, 0, 10, 10), w(50, 0, 10, 10), w(20, 1, 20, 10)]);
		expect(lines).toHaveLength(1);
		expect(lines[0].x).toBe(0);
		expect(lines[0].w).toBe(60);
	});
});
