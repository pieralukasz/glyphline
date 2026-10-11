// Motion of the read-aloud highlights: pure interpolators fed to svelte/motion `Tween`.
// The word cursor stretches along a line and pops between lines; the sentence outline morphs.

import { morphShape, type Shape, sameLine, sentenceShape, stretchBox } from './outline.ts';
import type { Box } from './types.ts';

/** Word cursor frame: a box plus how visible it is (0 hidden, 1 fully shown). */
export type WordFrame = { box: Box; o: number } | null;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
const popOut = (b: Box, t: number): WordFrame => ({ box: scaleBox(b, lerp(1, 0.8, t)), o: 1 - t });

/**
 * Interpolator from the cursor as it is on screen now to the next word:
 * - same line: one box stretches towards the new word, then contracts onto it;
 * - another line: it travels there; vertically it stretches like on a line (the edge on the side
 *   of the move reaches the new line first, the other edge follows), horizontally it glides to the
 *   new word, so going down or up a line reads as the same liquid motion as moving along it;
 * - nothing shown before: the new box pops in; nothing next: the old one pops out.
 * Starting from a frame that is mid-animation works (the tween restarts from `current`).
 */
export function interpolateWord(from: WordFrame, to: WordFrame): (t: number) => WordFrame {
	if (!to) return from ? (t) => (t >= 1 ? null : popOut(from.box, t)) : () => null;
	if (!from || from.o < 0.05) return (t) => popIn(to.box, t);
	if (sameLine(from.box, to.box)) {
		return (t) => ({ box: stretchBox(from.box, to.box, t), o: lerp(from.o, 1, t) });
	}
	return (t) => ({ box: travelBox(from.box, to.box, t), o: lerp(from.o, 1, t) });
}

/** Move to another line: vertical stretch (leading edge first), horizontal glide. */
export function travelBox(from: Box, to: Box, t: number): Box {
	const lead = Math.min(1, t * 2);
	const trail = Math.max(0, t * 2 - 1);
	const down = to.y + to.h / 2 >= from.y + from.h / 2;
	const top = down ? lerp(from.y, to.y, trail) : lerp(from.y, to.y, lead);
	const bottom = down
		? lerp(from.y + from.h, to.y + to.h, lead)
		: lerp(from.y + from.h, to.y + to.h, trail);
	return { x: lerp(from.x, to.x, t), y: top, w: lerp(from.w, to.w, t), h: bottom - top };
}

/** Sentence outline frame: its line shape and opacity. */
export type SentenceFrame = { shape: Shape; o: number } | null;

/**
 * Interpolator for the sentence outline: morphs the line boxes when both shapes have the same
 * number of runs (columns), otherwise cross-fades through nothing (fade out, then fade in).
 */
export function interpolateSentence(
	from: SentenceFrame,
	to: SentenceFrame
): (t: number) => SentenceFrame {
	if (!to) return from ? (t) => (t >= 1 ? null : { shape: from.shape, o: 1 - t }) : () => null;
	if (!from || from.o < 0.05) return (t) => ({ shape: to.shape, o: t });
	const morph = morphShape(from.shape, to.shape);
	if (morph) return (t) => ({ shape: morph(t), o: lerp(from.o, 1, t) });
	return (t) =>
		t < 0.5 ? { shape: from.shape, o: 1 - t * 2 } : { shape: to.shape, o: (t - 0.5) * 2 };
}

export const sentenceFrame = (boxes: Box[]): SentenceFrame =>
	boxes.length ? { shape: sentenceShape(boxes), o: 1 } : null;

/** Ease for both: fast start, soft landing. */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
