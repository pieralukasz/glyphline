import { describe, expect, it } from 'vitest';
import { interpolateSentence, interpolateWord, sentenceFrame } from '../src/core/motion.ts';

const box = (x: number, y: number, w = 30, h = 10) => ({ x, y, w, h });

describe('interpolateWord', () => {
	it('stretches along the line when the next word is on the same line', () => {
		const f = interpolateWord({ box: box(10, 100), o: 1 }, { box: box(80, 100), o: 1 });
		const mid = f(0.5);
		expect(mid?.o).toBe(1);
		expect(mid?.box.x).toBe(10);
		expect((mid?.box.x ?? 0) + (mid?.box.w ?? 0)).toBe(110);
		expect(f(1)?.box).toEqual(box(80, 100));
	});

	it('travels to another line: stretches down first, then pulls up, gliding sideways', () => {
		const from = box(400, 100);
		const to = box(10, 114);
		const f = interpolateWord({ box: from, o: 1 }, { box: to, o: 1 });
		const half = f(0.5)?.box;
		// at the half: still on the old line at the top, already on the new line at the bottom
		expect(half?.y).toBeCloseTo(100);
		expect((half?.y ?? 0) + (half?.h ?? 0)).toBeCloseTo(124);
		expect(half?.x).toBeCloseTo(205);
		expect(f(0.5)?.o).toBe(1);
		expect(f(1)).toEqual({ box: to, o: 1 });
	});

	it('travels up a line with the top edge leading', () => {
		const f = interpolateWord({ box: box(10, 114), o: 1 }, { box: box(400, 100), o: 1 });
		const half = f(0.5)?.box;
		expect(half?.y).toBeCloseTo(100);
		expect((half?.y ?? 0) + (half?.h ?? 0)).toBeCloseTo(124);
	});

	it('pops in from nothing, with a small overshoot', () => {
		const f = interpolateWord(null, { box: box(10, 100), o: 1 });
		expect(f(0)?.box.w).toBeLessThan(30);
		const sizes = [0.6, 0.7, 0.8].map((t) => f(t)?.box.w ?? 0);
		expect(Math.max(...sizes)).toBeGreaterThan(30);
		expect(f(1)?.box).toEqual(box(10, 100));
	});
});

describe('interpolateSentence', () => {
	it('morphs one sentence outline into the next', () => {
		const from = sentenceFrame([box(100, 100, 200), box(10, 114, 150)]);
		const to = sentenceFrame([box(160, 114, 140), box(10, 128, 290)]);
		const f = interpolateSentence(from, to);
		expect(f(0.5)?.o).toBe(1);
		expect(f(1)?.shape).toEqual(to?.shape);
	});

	it('fades through nothing when the column layout changes', () => {
		const from = sentenceFrame([box(10, 100)]);
		const to = sentenceFrame([box(10, 100), box(300, 100)]);
		const f = interpolateSentence(from, to);
		expect(f(0.5)?.o).toBeLessThan(0.05);
		expect(f(1)?.shape).toEqual(to?.shape);
	});
});
