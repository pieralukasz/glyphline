// Words and sentences of a text as character ranges, shared by every geometry source.
// Intl.Segmenter does the splitting; a few fixes make it match what a reader (or a voice) treats
// as one word or one sentence.

export type Word = {
	index: number;
	/** char range in the text, end exclusive */
	start: number;
	end: number;
	text: string;
	/** sentence index, -1 when the word sits outside every sentence */
	sentence: number;
};

export type Sentence = {
	index: number;
	start: number;
	end: number;
	text: string;
	/** word index range, end exclusive; -1 when the sentence has no words */
	firstWord: number;
	lastWord: number;
};

/** A character range, end exclusive. */
export type TextRange = { start: number; end: number };

export type Segmented = { words: Word[]; sentences: Sentence[] };

export type SegmentOptions = {
	/** char offsets where a sentence must end whatever the punctuation (block ends, headings) */
	breakAt?: number[];
	/** locale for Intl.Segmenter, default "en" */
	locale?: string;
};

const ABBREVIATIONS =
	/\b(e\.g|i\.e|et al|etc|cf|vs|fig|figs|eq|eqs|ref|refs|sec|no|vol|dr|prof|mr|mrs|ms|st|jr|al|approx|resp|ca|p|pp)\.\s*$/i;
const INITIAL = /(^|\s)[A-Z]\.\s*$/;

/** A run of math/currency symbols that a voice reads as a word; footnote marks excluded. */
const MATH_WORD = /^(?![∗*†‡§¶]+$)[\p{Sm}\p{Sc}]+$/u;

/** Split a text into sentences and words. */
export function segment(
	text: string,
	{ breakAt = [], locale = 'en' }: SegmentOptions = {}
): Segmented {
	const sentences = segmentSentences(text, breakAt, locale);
	const words = segmentWords(text, sentences, locale);
	for (const s of sentences) {
		const inside = words.filter((w) => w.sentence === s.index);
		s.firstWord = inside.length ? inside[0].index : -1;
		s.lastWord = inside.length ? inside[inside.length - 1].index + 1 : -1;
	}
	return { words, sentences };
}

/** Index of the word that contains `charIndex`, or -1 between words. */
export function wordAt(words: Word[], charIndex: number): number {
	let lo = 0;
	let hi = words.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const w = words[mid];
		if (charIndex < w.start) hi = mid - 1;
		else if (charIndex >= w.end) lo = mid + 1;
		else return mid;
	}
	return -1;
}

export function trimRange(text: string, start: number, end: number): [number, number] {
	while (start < end && /\s/.test(text[start])) start++;
	while (end > start && /\s/.test(text[end - 1])) end--;
	return [start, end];
}

function segmentSentences(text: string, breakAt: number[], locale: string): Sentence[] {
	const seg = new Intl.Segmenter(locale, { granularity: 'sentence' });
	const raw: { start: number; end: number }[] = [];
	// segment block by block so a forced layout boundary is never crossed
	let blockStart = 0;
	for (const blockEnd of [...breakAt, text.length]) {
		if (blockEnd <= blockStart) continue;
		for (const s of seg.segment(text.slice(blockStart, blockEnd))) {
			raw.push({ start: blockStart + s.index, end: blockStart + s.index + s.segment.length });
		}
		blockStart = blockEnd;
	}
	// Intl splits after "e.g." and "J." style abbreviations; glue those back together.
	const merged: { start: number; end: number }[] = [];
	for (const r of raw) {
		const prev = merged[merged.length - 1];
		const prevText = prev ? text.slice(prev.start, prev.end) : '';
		const forced = prev ? breakAt.includes(prev.end) : false;
		if (prev && !forced && (ABBREVIATIONS.test(prevText) || INITIAL.test(prevText))) {
			prev.end = r.end;
		} else {
			merged.push({ ...r });
		}
	}
	const out: Sentence[] = [];
	for (const r of merged) {
		const [start, end] = trimRange(text, r.start, r.end);
		if (start >= end) continue;
		out.push({
			index: out.length,
			start,
			end,
			text: text.slice(start, end),
			firstWord: -1,
			lastWord: -1
		});
	}
	return out;
}

function segmentWords(text: string, sentences: Sentence[], locale: string): Word[] {
	const seg = new Intl.Segmenter(locale, { granularity: 'word' });
	const words: Word[] = [];
	let si = 0;
	const push = (start: number, end: number) => {
		while (si < sentences.length && sentences[si].end <= start) si++;
		const sentence = si < sentences.length && sentences[si].start <= start ? si : -1;
		words.push({ index: words.length, start, end, text: text.slice(start, end), sentence });
	};
	for (const w of seg.segment(text)) {
		// Intl treats math operators as non-words, but voices read them, so they get highlighted
		if (!w.isWordLike && !MATH_WORD.test(w.segment)) continue;
		const start = w.index;
		const end = start + w.segment.length;
		const last = words[words.length - 1];
		// Intl splits "p.3", "Fig.3", "e.g." and "x@y.com" at the dot; a voice speaks them as one
		// token and reports one boundary, so the pieces are joined back when the glue between them
		// is a single dot or @ with no space and the sentence does not end there
		if (last && start - last.end === 1 && /[.@]/.test(text[last.end]) && last.sentence === si) {
			last.end = end;
			last.text = text.slice(last.start, end);
			continue;
		}
		push(start, end);
	}
	return words;
}
