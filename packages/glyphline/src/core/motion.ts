// Motion of the read-aloud highlights: pure interpolators fed to svelte/motion `Tween`.
// Nearby targets glide with bounded stretch; distant targets fade out and relocate.

import { morphShape, type Shape, sameLine, sentenceShape, stretchBox } from './outline.ts';
import type { Box } from './types.ts';

/** Word cursor frame: a box plus how visible it is (0 hidden, 1 fully shown). */
export type WordFrame = { box: Box; o: number } | null;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Keep line wraps local vertically; a distant target is a new focus, not a trail. */
function distantBoxes(a: Box, b: Box): boolean {
	const em = Math.max(a.h, b.h);
	if (sameLine(a, b)) return Math.max(b.x - a.x - a.w, a.x - b.x - b.w) > 4 * em;
	return Math.abs(a.y + a.h / 2 - b.y - b.h / 2) > 2 * em;
}

/** Internal policy shared with the scheduler; not a public timing option. */
export const relocatesWord = (from: WordFrame, to: WordFrame): boolean =>
	Boolean(from && to && distantBoxes(from.box, to.box));

/** Scale a box around its centre (`k` = 1 keeps it). */
function scaleBox(b: Box, k: number): Box {
	return { x: b.x + (b.w * (1 - k)) / 2, y: b.y + (b.h * (1 - k)) / 2, w: b.w * k, h: b.h * k };
}

/** A pop-in: grows from 70% with a small overshoot (back-out), fading in over the first third. */
function popIn(b: Box, t: number): WordFrame {
	const s = 1.70158;
	const u = t - 1;
	const back = 1 + (s + 1) * u ** 3 + s * u ** 2;
	return { box: scaleBox(b, lerp(0.7, 1, back)), o: Math.min(1, t * 3) };
}

/** A pop-out: shrinks to 80% and fades. */
const popOut = (b: Box, o: number, t: number): WordFrame => ({
	box: scaleBox(b, lerp(1, 0.8, t)),
	o: o * (1 - t)
});

/**
 * Interpolator from the cursor as it is on screen now to the next word:
 * - nearby word/line: a glide with stretch capped at one box height;
 * - distant target: fade out in place, relocate while hidden, then fade in;
 * - nothing shown before: the new box pops in; nothing next: the old one pops out.
 * Starting from a frame that is mid-animation works (the tween restarts from `current`).
 */
export function interpolateWord(from: WordFrame, to: WordFrame): (t: number) => WordFrame {
	if (!to) return from ? (t) => (t >= 1 ? null : popOut(from.box, from.o, t)) : () => null;
	if (!from) return (t) => popIn(to.box, t);
	if (relocatesWord(from, to)) {
		return (t) =>
			t < 0.5 ? { box: from.box, o: from.o * (1 - t * 2) } : { box: to.box, o: to.o * (t * 2 - 1) };
	}
	if (sameLine(from.box, to.box)) {
		return (t) => ({ box: stretchBox(from.box, to.box, t), o: lerp(from.o, to.o, t) });
	}
	return (t) => ({ box: travelBox(from.box, to.box, t), o: lerp(from.o, to.o, t) });
}

/** Move to a nearby line: bounded vertical stretch and a horizontal glide. */
export function travelBox(from: Box, to: Box, t: number): Box {
	const distance = Math.abs(to.y + to.h / 2 - from.y - from.h / 2);
	const extra = Math.min(distance, Math.max(from.h, to.h)) * 4 * t * (1 - t);
	return {
		x: lerp(from.x, to.x, t),
		y: lerp(from.y, to.y, t) - extra / 2,
		w: lerp(from.w, to.w, t),
		h: lerp(from.h, to.h, t) + extra
	};
}

/** Sentence outline frame: its line shape and opacity. */
export type SentenceFrame = { shape: Shape; o: number } | null;

/** Internal policy: disconnected layouts and distant runs relocate together. */
export const relocatesSentence = (from: SentenceFrame, to: SentenceFrame): boolean =>
	Boolean(
		from &&
			to &&
			(from.shape.length !== to.shape.length ||
				from.shape.some((run, i) => !run.some((a) => to.shape[i].some((b) => !distantBoxes(a, b)))))
	);

/**
 * Nearby sentence outlines with matching runs morph line by line. Distant or incompatible
 * layouts fade out in place and fade in at the destination without sweeping across the page.
 */
export function interpolateSentence(
	from: SentenceFrame,
	to: SentenceFrame
): (t: number) => SentenceFrame {
	if (!to)
		return from ? (t) => (t >= 1 ? null : { shape: from.shape, o: from.o * (1 - t) }) : () => null;
	if (!from) return (t) => ({ shape: to.shape, o: to.o * t });
	const morph = relocatesSentence(from, to) ? null : morphShape(from.shape, to.shape);
	if (morph) return (t) => ({ shape: morph(t), o: lerp(from.o, to.o, t) });
	return (t) =>
		t < 0.5
			? { shape: from.shape, o: from.o * (1 - t * 2) }
			: { shape: to.shape, o: to.o * (t - 0.5) * 2 };
}

export const sentenceFrame = (boxes: Box[]): SentenceFrame =>
	boxes.length ? { shape: sentenceShape(boxes), o: 1 } : null;

/** Ease for both: fast start, soft landing. */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
