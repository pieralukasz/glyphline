import { describe, expect, it } from 'vitest';
import { interpolateSentence, interpolateWord, sentenceFrame } from '../src/core/motion.ts';
import { sentenceShape } from '../src/core/outline.ts';

const box = (x: number, y: number, w = 30, h = 10) => ({ x, y, w, h });

describe('interpolateWord', () => {
	it('fades and relocates long jumps without covering intervening text in either direction', () => {
		const start = { box: box(10, 100), o: 1 };
		for (const end of [
			{ box: box(10, 500), o: 1 },
			{ box: box(400, 100), o: 1 }
		]) {
			for (const [from, to] of [
				[start, end],
				[end, start]
			]) {
				const f = interpolateWord(from, to);
				expect(f(0)).toEqual(from);
				expect(f(0.5)?.o).toBe(0);
				for (const t of [0.1, 0.25, 0.6, 0.9]) {
					expect(f(t)?.box).toEqual(t < 0.5 ? from.box : to.box);
				}
				expect(f(1)).toEqual(to);
			}
		}
	});
	it('stretches along the line when the next word is on the same line', () => {
		const f = interpolateWord({ box: box(10, 100), o: 1 }, { box: box(80, 100), o: 1 });
		const mid = f(0.5);
		expect(mid?.o).toBe(1);
		expect(mid?.box.x).toBeLessThan(45);
		expect(mid?.box.w).toBeLessThanOrEqual(40);
		expect(f(1)?.box).toEqual(box(80, 100));
	});

	it('glides to a nearby line with bounded vertical stretch', () => {
		const from = box(400, 100);
		const to = box(10, 114);
		const f = interpolateWord({ box: from, o: 1 }, { box: to, o: 1 });
		const half = f(0.5)?.box;
		expect(half?.y).toBeLessThan(107);
		expect(half?.h).toBeLessThanOrEqual(20);
		expect(half?.x).toBeCloseTo(205);
		expect(f(0.5)?.o).toBe(1);
		expect(f(1)).toEqual({ box: to, o: 1 });
	});

	it('glides up a line with the same bounded stretch', () => {
		const f = interpolateWord({ box: box(10, 114), o: 1 }, { box: box(400, 100), o: 1 });
		const half = f(0.5)?.box;
		expect(half?.y).toBeLessThan(107);
		expect(half?.h).toBeLessThanOrEqual(20);
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
	it('relocates distant sentences even when their run counts match', () => {
		const from = sentenceFrame([box(10, 100)]);
		const to = sentenceFrame([box(10, 500)]);
		const f = interpolateSentence(from, to);
		expect(f(0.25)?.shape).toEqual(from?.shape);
		expect(f(0.5)?.o).toBe(0);
		expect(f(0.75)?.shape).toEqual(to?.shape);
	});
	it('retargets from the exact visible opacity, including nearly hidden frames and removal', () => {
		for (const o of [0.02, 0.3]) {
			const word = { box: box(10, 100), o };
			const sentence = { shape: sentenceShape([box(10, 100)]), o };
			for (const target of [null, { box: box(80, 100), o: 1 }, { box: box(10, 500), o: 1 }]) {
				expect(interpolateWord(word, target)(0)).toEqual(word);
			}
			for (const target of [
				null,
				sentenceFrame([box(80, 100)]),
				sentenceFrame([box(10, 500)]),
				sentenceFrame([box(10, 100), box(300, 100)])
			]) {
				expect(interpolateSentence(sentence, target)(0)).toEqual(sentence);
			}
		}
	});
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
