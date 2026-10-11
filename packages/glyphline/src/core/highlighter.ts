// The highlighter: draws a sentence outline, a word cursor and static marks into an <svg> overlay,
// and animates the cursor and the outline between targets. Framework-free; the React and Svelte
// adapters are thin wrappers around it.

import {
	easeOutCubic,
	interpolateSentence,
	interpolateWord,
	type SentenceFrame,
	type WordFrame
} from './motion.ts';
import { sentenceShape, shapePath, wordPath, wordPaths } from './outline.ts';
import type { TextRange } from './segment.ts';
import type { TextSource } from './source.ts';
import type { Box } from './types.ts';

/** A highlight target: a word or sentence index of the source, a character range, or nothing. */
export type Target = number | TextRange | null | undefined;

/** A static highlight, such as a saved annotation or a search hit. */
export type Mark = {
	id: string;
	start: number;
	end: number;
	/** extra class on the mark's path, for colours */
	className?: string;
};

export type HighlightState = {
	/** the sentence outline: a sentence index or a character range */
	sentence?: Target;
	/** the word cursor: a word index or a character range */
	word?: Target;
	/** static highlights drawn under the outline and the cursor */
	marks?: readonly Mark[];
	/** the drawn text selection (set it yourself, or let `trackSelection` do it) */
	selection?: Target;
};

export type SelectionOptions = {
	/** grow the selection to whole words (default false: characters, like the browser) */
	snapToWords?: boolean;
	/** called with the selected range (null when cleared) and its text */
	onChange?: (range: TextRange | null, text: string) => void;
};

export type ShapeOptions = {
	/** padding around the text, overlay units */
	pad?: number;
	/** corner radius, overlay units */
	radius?: number;
};

export type HighlighterOptions = {
	/** animate between targets (default true); off: the highlights jump */
	animate?: boolean;
	/** honour `prefers-reduced-motion: reduce` by jumping (default true) */
	respectReducedMotion?: boolean;
	/** ms, defaults: word 240, sentence 340, selection 120 */
	duration?: { word?: number; sentence?: number; selection?: number };
	/** progress 0..1 to eased 0..1, default ease-out cubic */
	easing?: (t: number) => number;
	/** outline of sentences and marks; `snap` aligns line edges closer than that (default 4) */
	sentenceShape?: ShapeOptions & { snap?: number };
	/** rounded box of the word cursor */
	wordShape?: ShapeOptions;
	/** prefix of the class names on the overlay and its paths (default "gl") */
	classPrefix?: string;
	/**
	 * Draw the user's text selection as one rounded shape that follows the glyphs. Needs a source
	 * with `rangeFromSelection` (both built-in sources have it). Hide the browser's own selection
	 * colour with the `gl-native-selection-hidden` class from `glyphline/style.css`.
	 */
	trackSelection?: boolean | SelectionOptions;
};

export type Highlighter = {
	/** Move the highlights. Omitted keys keep their current value. */
	update(state: HighlightState): void;
	/** Swap the text (a new page, a re-read document). The highlights jump to the new place. */
	setSource(source: TextSource): void;
	/** Re-measure after a layout change; the highlights jump. Called on resize for live sources. */
	refresh(): void;
	setOptions(options: HighlighterOptions): void;
	readonly state: Readonly<HighlightState>;
	destroy(): void;
};

const SVG_NS = 'http://www.w3.org/2000/svg';

type Interpolator<T> = (from: T, to: T) => (t: number) => T;

/** Same contract as svelte/motion Tween: a new target restarts from the value on screen now. */
class Tween<T> {
	value: T;
	private frame = 0;
	constructor(
		initial: T,
		private readonly interpolate: Interpolator<T>,
		private readonly draw: () => void
	) {
		this.value = initial;
	}
	set(target: T, duration: number, easing: (t: number) => number) {
		cancelAnimationFrame(this.frame);
		const fn = this.interpolate(this.value, target);
		if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
			this.value = fn(1);
			this.draw();
			return;
		}
		const start = performance.now();
		const step = (now: number) => {
			const p = Math.min(1, (now - start) / duration);
			this.value = fn(easing(p));
			this.draw();
			if (p < 1) this.frame = requestAnimationFrame(step);
		};
		this.value = fn(0);
		this.draw();
		this.frame = requestAnimationFrame(step);
	}
	stop() {
		cancelAnimationFrame(this.frame);
	}
}

/** What changes the drawing (callbacks and timing do not): a change re-draws in place. */
const drawKey = (o: HighlighterOptions) =>
	JSON.stringify([o.sentenceShape, o.wordShape, o.classPrefix]);

const sameMarks = (a: readonly Mark[] = [], b: readonly Mark[] = []) =>
	a.length === b.length &&
	a.every(
		(m, i) =>
			m.id === b[i].id &&
			m.start === b[i].start &&
			m.end === b[i].end &&
			m.className === b[i].className
	);

const sameTarget = (a: Target, b: Target) =>
	a === b ||
	(typeof a === 'object' &&
		typeof b === 'object' &&
		a !== null &&
		b !== null &&
		a.start === b.start &&
		a.end === b.end);

/**
 * Attach a highlighter to an `<svg>` that sits over (or under) the text. The svg should cover the
 * text exactly; `glyphline/style.css` has a `.gl-overlay` class for that.
 */
export function createHighlighter(
	svg: SVGSVGElement,
	source: TextSource,
	options: HighlighterOptions = {}
): Highlighter {
	let src = source;
	let opts = options;
	let state: HighlightState = {};
	const prefix = () => opts.classPrefix ?? 'gl';

	const marksGroup = document.createElementNS(SVG_NS, 'g');
	const selectionPath = document.createElementNS(SVG_NS, 'path');
	const sentencePath = document.createElementNS(SVG_NS, 'path');
	const wordEl = document.createElementNS(SVG_NS, 'path');
	const applyClasses = () => {
		const p = prefix();
		svg.classList.add(`${p}-overlay`);
		marksGroup.setAttribute('class', `${p}-marks`);
		selectionPath.setAttribute('class', `${p}-selection`);
		sentencePath.setAttribute('class', `${p}-sentence`);
		wordEl.setAttribute('class', `${p}-word`);
	};
	applyClasses();
	svg.setAttribute('aria-hidden', 'true');
	svg.append(marksGroup, selectionPath, sentencePath, wordEl);

	/** extra boxes of the current word (a word broken across lines): drawn as they are */
	let wordTail: Box[] = [];

	const drawSentence = () => {
		const f = sentence.value;
		sentencePath.setAttribute('d', f ? shapePath(f.shape, opts.sentenceShape?.radius ?? 5) : '');
		sentencePath.style.opacity = f ? String(f.o) : '0';
	};
	const drawSelection = () => {
		const f = selection.value;
		selectionPath.setAttribute('d', f ? shapePath(f.shape, opts.sentenceShape?.radius ?? 5) : '');
		selectionPath.style.opacity = f ? String(f.o) : '0';
	};
	const drawWord = () => {
		const f = word.value;
		const shape = opts.wordShape;
		let d = '';
		if (f && f.box.w > 0) {
			d = wordPath(f.box, shape);
			if (wordTail.length) d += ` ${wordPaths(wordTail, shape)}`;
		}
		wordEl.setAttribute('d', d);
		wordEl.style.opacity = f ? String(f.o) : '0';
	};
	const sentence = new Tween<SentenceFrame>(null, interpolateSentence, drawSentence);
	const word = new Tween<WordFrame>(null, interpolateWord, drawWord);
	const selection = new Tween<SentenceFrame>(null, interpolateSentence, drawSelection);

	const rangeOf = (t: Target, kind: 'word' | 'sentence'): TextRange | null => {
		if (t == null) return null;
		if (typeof t === 'number') {
			const r = kind === 'word' ? src.words[t] : src.sentences[t];
			return r ? { start: r.start, end: r.end } : null;
		}
		return t.end > t.start ? t : null;
	};
	const boxesOf = (r: TextRange | null) => (r ? src.boxes(r.start, r.end, svg) : []);
	const shapeOpts = () => ({ pad: 2, snap: 4, ...opts.sentenceShape });

	const moving = () => {
		if (opts.animate === false) return false;
		if (opts.respectReducedMotion === false) return true;
		return !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
	};

	const setViewBox = () => {
		const v = src.viewBox(svg);
		svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
	};

	const placeSentence = (animate: boolean) => {
		const boxes = boxesOf(rangeOf(state.sentence, 'sentence'));
		const target: SentenceFrame = boxes.length
			? { shape: sentenceShape(boxes, shapeOpts()), o: 1 }
			: null;
		sentence.set(
			target,
			animate ? (opts.duration?.sentence ?? 340) : 0,
			opts.easing ?? easeOutCubic
		);
	};
	const placeWord = (animate: boolean) => {
		const boxes = boxesOf(rangeOf(state.word, 'word'));
		wordTail = boxes.slice(1);
		const target: WordFrame = boxes[0] ? { box: boxes[0], o: 1 } : null;
		word.set(target, animate ? (opts.duration?.word ?? 240) : 0, opts.easing ?? easeOutCubic);
	};
	const placeSelection = (animate: boolean) => {
		const boxes = boxesOf(rangeOf(state.selection, 'sentence'));
		const target: SentenceFrame = boxes.length
			? { shape: sentenceShape(boxes, shapeOpts()), o: 1 }
			: null;
		selection.set(
			target,
			animate ? (opts.duration?.selection ?? 120) : 0,
			opts.easing ?? easeOutCubic
		);
	};
	const placeMarks = () => {
		const p = prefix();
		const radius = opts.sentenceShape?.radius ?? 5;
		const paths = (state.marks ?? []).map((m) => {
			const path = document.createElementNS(SVG_NS, 'path');
			path.setAttribute('class', m.className ? `${p}-mark ${m.className}` : `${p}-mark`);
			path.dataset.id = m.id;
			const boxes = src.boxes(m.start, m.end, svg);
			path.setAttribute(
				'd',
				boxes.length ? shapePath(sentenceShape(boxes, shapeOpts()), radius) : ''
			);
			return path;
		});
		marksGroup.replaceChildren(...paths);
	};

	const redraw = () => {
		setViewBox();
		placeMarks();
		placeSelection(false);
		placeSentence(false);
		placeWord(false);
	};

	// selection tracking: selectionchange fires on the document, so filter to this source
	let unwatch: (() => void) | null = null;
	const watch = () => {
		unwatch?.();
		unwatch = null;
		if (!opts.trackSelection || !src.rangeFromSelection || typeof document === 'undefined') return;
		let lastKey = '';
		const onChange = () => {
			// read the options on every event: adapters pass a fresh onChange closure each render
			const t = opts.trackSelection;
			const conf: SelectionOptions = typeof t === 'object' ? t : {};
			let r = src.rangeFromSelection?.(document.getSelection()) ?? null;
			if (r && conf.snapToWords) r = snapToWords(src, r);
			const key = r ? `${r.start}:${r.end}` : '';
			if (key === lastKey) return;
			lastKey = key;
			state = { ...state, selection: r };
			placeSelection(moving());
			conf.onChange?.(r, r ? src.text.slice(r.start, r.end) : '');
		};
		document.addEventListener('selectionchange', onChange);
		unwatch = () => document.removeEventListener('selectionchange', onChange);
	};

	let observer: ResizeObserver | null = null;
	let lastSize = '';
	const observe = () => {
		observer?.disconnect();
		observer = null;
		if (!src.live || typeof ResizeObserver === 'undefined') return;
		observer = new ResizeObserver(() => {
			const r = svg.getBoundingClientRect();
			const size = `${r.width}x${r.height}`;
			if (size === lastSize) return;
			lastSize = size;
			redraw();
		});
		observer.observe(svg);
	};

	setViewBox();
	observe();
	watch();

	return {
		update(next) {
			const prev = state;
			state = { ...state, ...next };
			const animate = moving();
			if ('marks' in next && !sameMarks(prev.marks, state.marks)) placeMarks();
			if ('sentence' in next && !sameTarget(prev.sentence, state.sentence)) placeSentence(animate);
			if ('word' in next && !sameTarget(prev.word, state.word)) placeWord(animate);
			if ('selection' in next && !sameTarget(prev.selection, state.selection))
				placeSelection(animate);
		},
		setSource(next) {
			if (next === src) return;
			src = next;
			observe();
			watch();
			redraw();
		},
		refresh: redraw,
		setOptions(next) {
			const prev = opts;
			opts = next;
			if (Boolean(prev.trackSelection) !== Boolean(next.trackSelection)) watch();
			if (drawKey(prev) !== drawKey(next)) {
				applyClasses();
				redraw();
			}
		},
		get state() {
			return state;
		},
		destroy() {
			sentence.stop();
			word.stop();
			selection.stop();
			observer?.disconnect();
			unwatch?.();
			marksGroup.remove();
			selectionPath.remove();
			sentencePath.remove();
			wordEl.remove();
		}
	};
}

/** Grow a range to the word boundaries it touches (a range between words stays as it is). */
export function snapToWords(source: TextSource, r: TextRange): TextRange {
	let { start, end } = r;
	for (const w of source.words) {
		if (w.end <= start) continue;
		if (w.start >= end) break;
		start = Math.min(start, w.start);
		end = Math.max(end, w.end);
	}
	return { start, end };
}
