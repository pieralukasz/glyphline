// One string per page built from pdf.js text items, with every character mapped back to (item,
// offset). Words and sentences are ranges in that string, shared by every geometry method and TTS.

import {
	type Sentence,
	segment,
	trimRange,
	type Word,
	wordAt as wordAtIn
} from '../core/segment.ts';

export type { Sentence, Word };

export type TextItem = {
	str: string;
	/** pdf.js bidi result: for 'rtl' the string is in logical order, the glyph stream is visual */
	dir?: 'ltr' | 'rtl' | 'ttb';
	transform: number[];
	width: number;
	height: number;
	fontName: string;
	hasEOL: boolean;
};

export type PageText = {
	text: string;
	items: TextItem[];
	/** page char index -> item index, -1 for synthesized characters (spaces at line ends) */
	charItem: Int32Array;
	/** page char index -> offset inside item.str, -1 for synthesized characters */
	charOffset: Int32Array;
	/** item index -> page char index of its first character */
	itemStart: Int32Array;
	/** item index -> visual line index */
	itemLine: Int32Array;
	words: Word[];
	sentences: Sentence[];
};

/** A line-end hyphen joins two fragments of one word ("dispro-" + "portionately"). */
function joinsAcrossLine(current: string, next: string | undefined) {
	if (!next) return false;
	return /[A-Za-z]-$/.test(current) && /^[a-z]/.test(next.trimStart());
}

type Line = {
	first: number; // item index range, end inclusive
	last: number;
	size: number;
};

const fontSize = (t: number[], fallback: number) => Math.hypot(t[2], t[3]) || fallback || 1;

/**
 * Items grouped into visual lines by geometry: pdf.js sets `hasEOL` only inside what it considers
 * one block, so a heading followed by body text or a table row may carry no EOL at all.
 */
function lines(items: TextItem[]): Line[] {
	const out: Line[] = [];
	let first = 0;
	let prev = -1;
	const flush = (last: number) => {
		// dominant size: weighted by text length so one big operator does not define the line
		const weight = new Map<number, number>();
		for (let k = first; k <= last; k++) {
			const t = items[k].str.trim();
			if (!t) continue;
			const sz = Math.round(fontSize(items[k].transform, items[k].height) * 2) / 2;
			weight.set(sz, (weight.get(sz) ?? 0) + t.length);
		}
		let size = 0;
		let best = -1;
		for (const [sz, w] of weight) {
			if (w > best) {
				best = w;
				size = sz;
			}
		}
		out.push({ first, last, size: size || fontSize(items[first].transform, items[first].height) });
		first = last + 1;
	};
	let lineSize = 0;
	for (let i = 0; i < items.length; i++) {
		if (!items[i].str.trim()) continue;
		const size = fontSize(items[i].transform, items[i].height);
		if (prev >= 0) {
			const a = items[prev];
			const { along, down } = relative(a, items[i]);
			// sub/superscripts, big operators and inline symbols follow right on and stay on the line
			const ref = Math.max(lineSize, size);
			const continues = along >= a.width - 0.5 * ref && along <= a.width + 3 * ref;
			const shifted = Math.abs(down) <= 1.2 * ref;
			if (!(continues && shifted)) {
				flush(i - 1);
				lineSize = 0;
			}
		}
		lineSize = Math.max(lineSize, size);
		prev = i;
	}
	if (first < items.length) flush(items.length - 1);
	return out;
}

/** Position of item `b` relative to the origin of item `a`, in a's line direction: along, down. */
function relative(a: TextItem, b: TextItem) {
	const [ax, ay, , , ae, af] = a.transform;
	const len = Math.hypot(ax, ay) || 1;
	const dx = b.transform[4] - ae;
	const dy = b.transform[5] - af;
	return { along: (dx * ax + dy * ay) / len, down: -(dx * -ay + dy * ax) / len };
}

const LIST_MARKER = /^\s*([•◦▪‣\-–—]|\(?\d{1,3}[.)]|[A-Z]\d{1,2}|[IVX]{1,4}\.|[a-z][.)])(\s|$)/;

/**
 * Item indices after which the layout forces a sentence boundary whatever the punctuation: font
 * size change, block gap, jump up or to a new column, table cells, list marker.
 */
function forcedBreaks(items: TextItem[], ls: Line[]): Set<number> {
	const breaks = new Set<number>();
	const tabular = new Set<number>();
	// table cells: more than 3 em between two printed items on one line
	for (const [li, line] of ls.entries()) {
		let prev = -1;
		for (let k = line.first; k <= line.last; k++) {
			if (!items[k].str.trim()) continue;
			if (prev >= 0) {
				const { along, down } = relative(items[prev], items[k]);
				const gap = along - items[prev].width;
				if (
					Math.abs(down) < line.size &&
					gap > 3 * fontSize(items[prev].transform, items[prev].height)
				) {
					breaks.add(k - 1);
					tabular.add(li);
				}
			}
			prev = k;
		}
	}
	const firstPrinted = (l: Line) => {
		for (let k = l.first; k <= l.last; k++) if (items[k].str.trim()) return items[k];
		return items[l.first];
	};
	for (let li = 0; li < ls.length - 1; li++) {
		const cur = ls[li];
		const nxt = ls[li + 1];
		const curItem = firstPrinted(cur);
		const nxtItem = firstPrinted(nxt);
		const ratio = nxt.size / cur.size;
		const { down } = relative(curItem, nxtItem);
		const sizeChange = ratio < 0.85 || ratio > 1.18;
		const blockGap = down > 1.7 * cur.size;
		const jumpsUp = down < -0.5 * cur.size;
		const marker = LIST_MARKER.test(nxtItem.str) || LIST_MARKER.test(curItem.str);
		const table = tabular.has(li) || tabular.has(li + 1);
		if (sizeChange || blockGap || jumpsUp || marker || table) breaks.add(cur.last);
	}
	return breaks;
}

export function buildPageText(
	items: TextItem[],
	{ locale = 'en' }: { locale?: string } = {}
): PageText {
	let text = '';
	const charItem: number[] = [];
	const charOffset: number[] = [];
	const itemStart = new Int32Array(items.length);
	const ls = lines(items);
	const itemLine = new Int32Array(items.length);
	for (const [li, l] of ls.entries()) itemLine.fill(li, l.first, l.last + 1);
	const breakAfterItem = forcedBreaks(items, ls);
	const lineEnd = new Set(ls.map((l) => l.last));
	const breakAt: number[] = [];
	const synthesizedSpace = () => {
		text += ' ';
		charItem.push(-1);
		charOffset.push(-1);
	};

	let prevPrinted = -1;
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		// a visible gap between two items on one line is a space even when the PDF has none
		if (prevPrinted >= 0 && item.str.trim() && !text.endsWith(' ') && !item.str.startsWith(' ')) {
			const prev = items[prevPrinted];
			const { along, down } = relative(prev, item);
			const size = fontSize(prev.transform, prev.height);
			if (Math.abs(down) < 0.5 * size && along - prev.width > 0.2 * size) synthesizedSpace();
		}
		if (item.str.trim()) prevPrinted = i;
		itemStart[i] = text.length;
		let str = item.str;
		const next = items[i + 1]?.str;
		const eol = item.hasEOL || lineEnd.has(i);
		const dropHyphen = eol && joinsAcrossLine(str, next);
		if (dropHyphen) str = str.slice(0, -1);
		for (let o = 0; o < str.length; o++) {
			text += str[o];
			charItem.push(i);
			charOffset.push(o);
		}
		if (eol && !dropHyphen && !text.endsWith(' ')) synthesizedSpace();
		if (breakAfterItem.has(i)) breakAt.push(text.length);
	}

	const { words, sentences } = segment(text, { breakAt, locale });

	return {
		text,
		items,
		charItem: Int32Array.from(charItem),
		charOffset: Int32Array.from(charOffset),
		itemStart,
		itemLine,
		words,
		sentences
	};
}

export type WordPart = { word: number; start: number; end: number; text: string };

/**
 * Words split where they cross a visual line ("dispro-" + EOL + "portionately" is one word in two
 * parts). Built from the text model only, so every geometry method is measured on the same units.
 */
export function wordParts(page: PageText): WordPart[] {
	const parts: WordPart[] = [];
	const push = (word: number, from: number, to: number) => {
		const [start, end] = trimRange(page.text, from, to);
		if (start < end) parts.push({ word, start, end, text: page.text.slice(start, end) });
	};
	for (const w of page.words) {
		let s = w.start;
		for (let c = w.start + 1; c < w.end; c++) {
			const a = page.charItem[c - 1];
			const b = page.charItem[c];
			if (a >= 0 && b >= 0 && page.itemLine[a] !== page.itemLine[b]) {
				push(w.index, s, c);
				s = c;
			}
		}
		push(w.index, s, w.end);
	}
	return parts;
}

/** Word index for a character position, or -1 when the position is between words. */
export const wordAt = (page: PageText, charIndex: number): number =>
	wordAtIn(page.words, charIndex);
