import type { Sentence, TextRange, Word } from './segment.ts';
import type { Box } from './types.ts';

/**
 * Text that glyphline can highlight: one string, its words and sentences as character ranges, and
 * a way to find where any range sits on screen. `glyphline/pdf` and `glyphline/dom` build one;
 * anything else (a canvas editor, a custom renderer) can implement it.
 */
export interface TextSource {
	readonly text: string;
	readonly words: readonly Word[];
	readonly sentences: readonly Sentence[];
	/**
	 * Boxes of the characters `[start, end)`, one per line fragment, in the overlay's coordinate
	 * space (the space set by `viewBox`). Characters without geometry are skipped.
	 */
	boxes(start: number, end: number, overlay: Element): Box[];
	/** The overlay's viewBox: the coordinate space `boxes` returns. */
	viewBox(overlay: Element): Box;
	/**
	 * True when boxes follow live layout (HTML text reflows on resize): the highlighter then
	 * re-measures when the overlay changes size.
	 */
	readonly live?: boolean;
	/** Character range of a DOM selection inside this text, or null (enables selection drawing). */
	rangeFromSelection?(selection: Selection | null): TextRange | null;
}

/** Character range of word `i`, or null when there is no such word. */
export const wordRange = (source: TextSource, i: number): TextRange | null => {
	const w = source.words[i];
	return w ? { start: w.start, end: w.end } : null;
};

/** Character range of sentence `i`, or null when there is no such sentence. */
export const sentenceRange = (source: TextSource, i: number): TextRange | null => {
	const s = source.sentences[i];
	return s ? { start: s.start, end: s.end } : null;
};

/**
 * Overlay coordinates of a viewport point: the inverse of how the svg's viewBox is drawn
 * (`preserveAspectRatio="none"`, so x and y scale independently).
 */
export function toOverlay(overlay: Element, clientX: number, clientY: number): [number, number] {
	const r = overlay.getBoundingClientRect();
	const v = (overlay as SVGSVGElement).viewBox?.baseVal;
	const vw = v?.width || r.width || 1;
	const vh = v?.height || r.height || 1;
	return [
		(v?.x ?? 0) + ((clientX - r.left) / (r.width || 1)) * vw,
		(v?.y ?? 0) + ((clientY - r.top) / (r.height || 1)) * vh
	];
}

/**
 * Index of the word under a viewport point (a click or pointer position), or -1. `slop` grows
 * each word box by that many overlay units, so the gap between two words still hits one of them.
 */
export function wordAtPoint(
	source: TextSource,
	overlay: Element,
	clientX: number,
	clientY: number,
	{ slop = 1 } = {}
): number {
	const [x, y] = toOverlay(overlay, clientX, clientY);
	for (const w of source.words) {
		for (const b of source.boxes(w.start, w.end, overlay)) {
			if (x >= b.x - slop && x <= b.x + b.w + slop && y >= b.y - slop && y <= b.y + b.h + slop)
				return w.index;
		}
	}
	return -1;
}
