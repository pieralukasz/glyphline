import { beforeEach, describe, expect, it } from 'vitest';
import { buildPageText, type TextItem, wordAt } from '../src/pdf/text-model.ts';

const at = (str: string, x: number, y: number, size = 10, hasEOL = false): TextItem => ({
	str,
	transform: [size, 0, 0, size, x, y],
	width: str.length * size * 0.5,
	height: size,
	fontName: 'f1',
	hasEOL
});

let cursorX = 0;
let cursorY = 0;
/** Items laid out like a text line: each follows the previous one; an EOL starts the next line. */
const item = (str: string, hasEOL = false, size = 10): TextItem => {
	const it = at(str, cursorX, cursorY, size, hasEOL);
	cursorX += it.width;
	if (hasEOL) {
		cursorX = 0;
		cursorY -= size * 1.2;
	}
	return it;
};
beforeEach(() => {
	cursorX = 0;
	cursorY = 0;
});

describe('buildPageText', () => {
	it('maps every character back to its item and offset', () => {
		const page = buildPageText([item('Hello'), item(' world', true)]);
		expect(page.text).toBe('Hello world ');
		expect(page.charItem[0]).toBe(0);
		expect(page.charItem[6]).toBe(1);
		expect(page.charOffset[6]).toBe(1);
		expect(page.charItem[11]).toBe(-1); // synthesized space after EOL
		expect(page.itemStart[1]).toBe(5);
	});

	it('inserts a space at line ends so words do not merge across lines', () => {
		const page = buildPageText([item('end of line', true), item('next line')]);
		expect(page.words.map((w) => w.text)).toEqual(['end', 'of', 'line', 'next', 'line']);
	});

	it('joins a hyphenated word across a line break', () => {
		const page = buildPageText([item('dispro-', true), item('portionately large')]);
		expect(page.text.startsWith('disproportionately')).toBe(true);
		const w = page.words[0];
		expect(w.text).toBe('disproportionately');
		expect(page.charItem[w.start]).toBe(0);
		expect(page.charItem[w.end - 1]).toBe(1);
	});

	it('keeps a real hyphenated compound when the next line starts with a capital', () => {
		const page = buildPageText([item('Event-', true), item('Horizon')]);
		expect(page.words.map((w) => w.text)).toEqual(['Event', 'Horizon']);
	});

	it('segments sentences and does not split on abbreviations', () => {
		const page = buildPageText([
			item('We use e.g. two methods. The second, by J. Smith et al. (2019), works. Done.')
		]);
		expect(page.sentences.map((s) => s.text)).toEqual([
			'We use e.g. two methods.',
			'The second, by J. Smith et al. (2019), works.',
			'Done.'
		]);
	});

	it('assigns words to sentences', () => {
		const page = buildPageText([item('First one. Second two three.')]);
		const s = page.sentences;
		expect(s[0].firstWord).toBe(0);
		expect(s[0].lastWord).toBe(2);
		expect(s[1].firstWord).toBe(2);
		expect(s[1].lastWord).toBe(5);
		expect(page.words.map((w) => w.sentence)).toEqual([0, 0, 1, 1, 1]);
	});

	it('treats numbers, units and math operators as words, footnote marks not', () => {
		const page = buildPageText([item('diameter∗ of 42 ± 3 μas, which is circular')]);
		expect(page.words.map((w) => w.text)).toEqual([
			'diameter',
			'of',
			'42',
			'±',
			'3',
			'μas',
			'which',
			'is',
			'circular'
		]);
	});

	it('finds the word at a character index', () => {
		const page = buildPageText([item('alpha beta')]);
		expect(wordAt(page, 0)).toBe(0);
		expect(wordAt(page, 4)).toBe(0);
		expect(wordAt(page, 5)).toBe(-1);
		expect(wordAt(page, 7)).toBe(1);
	});
});

describe('layout-driven sentence boundaries', () => {
	it('a heading without a full stop is its own sentence (font size change)', () => {
		const page = buildPageText([
			at('Results and discussion', 40, 700, 15),
			at('The ring is bright on the south side and', 40, 680, 9),
			at('fades toward the north.', 40, 668, 9)
		]);
		expect(page.sentences.map((s) => s.text)).toEqual([
			'Results and discussion',
			'The ring is bright on the south side and fades toward the north.'
		]);
	});

	it('table cells separated by a wide gap do not merge into one sentence', () => {
		const page = buildPageText([
			at('A1', 48, 741),
			at('p.2', 74, 741),
			at('Narrow vs wide glyphs', 104, 741),
			at('every letter has the same width', 298, 741, 7),
			at('A2', 48, 728),
			at('p.2', 74, 728),
			at('Long single-chunk lines', 104, 728),
			at('error accumulates toward the end', 298, 728, 7)
		]);
		expect(page.sentences.map((s) => s.text)).toEqual([
			'A1 p.2 Narrow vs wide glyphs',
			'every letter has the same width',
			'A2 p.2 Long single-chunk lines',
			'error accumulates toward the end'
		]);
	});

	it('author blocks laid out in columns stay separate', () => {
		const page = buildPageText([
			at('Ashish Vaswani', 116, 549),
			at('Google Brain', 139, 538),
			at('avaswani@google.com', 116, 527),
			at('Noam Shazeer', 239, 549),
			at('Google Brain', 242, 538),
			at('noam@google.com', 230, 527)
		]);
		expect(page.sentences.map((s) => s.text)).toEqual([
			'Ashish Vaswani Google Brain avaswani@google.com',
			'Noam Shazeer Google Brain noam@google.com'
		]);
	});

	it('a paragraph gap starts a new sentence even without punctuation', () => {
		const page = buildPageText([
			at('first paragraph ends here', 40, 700),
			at('second paragraph starts here', 40, 670)
		]);
		expect(page.sentences).toHaveLength(2);
	});

	it('a wrapped line inside a paragraph is not a boundary', () => {
		const page = buildPageText([
			at('this sentence continues on the', 40, 700),
			at('next line and ends here.', 40, 688)
		]);
		expect(page.sentences).toHaveLength(1);
	});
});

describe('tokens a voice speaks as one word', () => {
	it('keeps "p.3", "Fig.3" and e-mail addresses together, splits at sentence ends', () => {
		const page = buildPageText([
			at('B2 p.3 see Fig.3 and 42.5 ok, mail a@b.com too. Next one', 40, 700)
		]);
		expect(page.sentences).toHaveLength(2);
		expect(page.words.map((w) => w.text)).toEqual([
			'B2',
			'p.3',
			'see',
			'Fig.3',
			'and',
			'42.5',
			'ok',
			'mail',
			'a@b.com',
			'too',
			'Next',
			'one'
		]);
	});
});
