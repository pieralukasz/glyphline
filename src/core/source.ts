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
