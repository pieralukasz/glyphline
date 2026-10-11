import { afterEach, describe, expect, it } from 'vitest';
import { createHighlighter } from '../../src/core/highlighter.ts';
import { domSource } from '../../src/dom/source.ts';

const mount = (html: string) => {
	const host = document.createElement('div');
	host.style.cssText = 'position:relative;width:320px;font:16px/1.5 serif;padding:8px';
	host.innerHTML = `<div class="text">${html}</div>`;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
	host.append(svg);
	document.body.append(host);
	const root = host.querySelector('.text') as HTMLElement;
	return { host, root, svg };
};
afterEach(() => {
	document.body.innerHTML = '';
});

const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)));

describe('domSource', () => {
	it('segments words and sentences across inline elements', () => {
		const { root } = mount('<p>Hello <b>bold</b> world. Second <i>sen</i>tence here.</p>');
		const s = domSource(root);
		expect(s.sentences.map((x) => x.text)).toEqual(['Hello bold world.', 'Second sentence here.']);
		expect(s.words.map((w) => w.text)).toContain('sentence');
	});

	it('ends a sentence at a block boundary even without punctuation', () => {
		const { root } = mount('<h2>A heading</h2><p>Body text starts here.</p>');
		const s = domSource(root);
		expect(s.sentences.map((x) => x.text)).toEqual(['A heading', 'Body text starts here.']);
	});

	it('skips script and data-glyphline-skip content', () => {
		const { root } = mount(
			'<p>Keep <span data-glyphline-skip>drop</span>this.</p><script>x()</script>'
		);
		const s = domSource(root);
		expect(s.text).not.toContain('drop');
		expect(s.text).not.toContain('x()');
	});

	it('returns one box per line, relative to the overlay', () => {
		const { root, svg } = mount('<p>' + 'word '.repeat(60) + '</p>');
		const s = domSource(root);
		const all = s.boxes(0, s.text.length, svg);
		expect(all.length).toBeGreaterThan(3);
		for (let i = 1; i < all.length; i++) expect(all[i].y).toBeGreaterThan(all[i - 1].y);
		const o = svg.getBoundingClientRect();
		const r = s.toRange(s.words[0].start, s.words[0].end)?.getBoundingClientRect();
		const [w0] = s.boxes(s.words[0].start, s.words[0].end, svg);
		expect(w0.x).toBeCloseTo((r?.left ?? 0) - o.left, 1);
		expect(w0.w).toBeCloseTo(r?.width ?? 0, 1);
	});

	it('maps a DOM selection to a character range and back', () => {
		const { root } = mount('<p>Alpha <em>beta</em> gamma delta.</p>');
		const s = domSource(root);
		const w = s.words.find((x) => x.text === 'gamma');
		if (!w) throw new Error('no word');
		const sel = document.getSelection();
		sel?.removeAllRanges();
		const r = s.toRange(s.words[1].start, w.end);
		if (!r) throw new Error('no range');
		sel?.addRange(r);
		expect(s.rangeFromSelection(sel)).toEqual({ start: s.words[1].start, end: w.end });
		expect(sel?.toString()).toBe('beta gamma');
	});

	it('finds the character under a point', () => {
		const { root } = mount('<p>Alpha beta gamma.</p>');
		const s = domSource(root);
		const r = s.toRange(s.words[1].start, s.words[1].end)?.getBoundingClientRect();
		if (!r) throw new Error('no rect');
		const i = s.charAtPoint(r.left + r.width / 2, r.top + r.height / 2);
		expect(i).toBeGreaterThanOrEqual(s.words[1].start);
		expect(i).toBeLessThan(s.words[1].end);
	});
});

describe('createHighlighter on HTML', () => {
	it('draws the sentence, the word and marks, and clears them', async () => {
		const { root, svg } = mount('<p>One two three. Four five six seven.</p>');
		const s = domSource(root);
		const hl = createHighlighter(svg, s, { animate: false });
		hl.update({ sentence: 1, word: 4, marks: [{ id: 'm', start: 0, end: 3, className: 'note' }] });
		expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toMatch(/^M/);
		expect(svg.querySelector('.gl-word')?.getAttribute('d')).toMatch(/^M/);
		expect(svg.querySelector('.gl-mark.note')?.getAttribute('data-id')).toBe('m');
		hl.update({ sentence: null, word: null, marks: [] });
		expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toBe('');
		expect(svg.querySelector('.gl-word')?.getAttribute('d')).toBe('');
		expect(svg.querySelectorAll('.gl-mark')).toHaveLength(0);
		hl.destroy();
		expect(svg.childElementCount).toBe(0);
	});

	it('animates the word cursor through intermediate frames', async () => {
		const { root, svg } = mount('<p>One two three four five six.</p>');
		const s = domSource(root);
		const hl = createHighlighter(svg, s, { respectReducedMotion: false, duration: { word: 200 } });
		hl.update({ word: 0 });
		await new Promise((r) => setTimeout(r, 260));
		const start = svg.querySelector('.gl-word')?.getAttribute('d');
		hl.update({ word: 4 });
		await raf();
		await raf();
		const mid = svg.querySelector('.gl-word')?.getAttribute('d');
		await new Promise((r) => setTimeout(r, 260));
		const end = svg.querySelector('.gl-word')?.getAttribute('d');
		expect(mid).not.toBe(start);
		expect(mid).not.toBe(end);
		hl.destroy();
	});

	it('re-measures when the text reflows', async () => {
		const { host, root, svg } = mount('<p>' + 'word '.repeat(40) + '</p>');
		const s = domSource(root);
		const hl = createHighlighter(svg, s, { animate: false });
		hl.update({ sentence: { start: 0, end: s.text.length } });
		const before = svg.querySelector('.gl-sentence')?.getAttribute('d');
		host.style.width = '200px';
		await raf();
		await raf();
		await raf();
		const after = svg.querySelector('.gl-sentence')?.getAttribute('d');
		expect(after).not.toBe(before);
		expect(svg.getAttribute('viewBox')).toMatch(/^0 0 216 /); // 200 + 2 × 8 px padding;
		hl.destroy();
	});

	it('tracks the selection, snapped to words', async () => {
		const { root, svg } = mount('<p>Alpha beta gamma delta.</p>');
		const s = domSource(root);
		const seen: string[] = [];
		const hl = createHighlighter(svg, s, {
			animate: false,
			trackSelection: { snapToWords: true, onChange: (_r, text) => seen.push(text) }
		});
		const r = document.createRange();
		const t = root.querySelector('p')?.firstChild as Text;
		r.setStart(t, 8); // inside "beta"
		r.setEnd(t, 13); // inside "gamma"
		document.getSelection()?.removeAllRanges();
		document.getSelection()?.addRange(r);
		await new Promise((res) => setTimeout(res, 50));
		expect(seen.at(-1)).toBe('beta gamma');
		expect(svg.querySelector('.gl-selection')?.getAttribute('d')).toMatch(/^M/);
		document.getSelection()?.removeAllRanges();
		await new Promise((res) => setTimeout(res, 50));
		expect(seen.at(-1)).toBe('');
		expect(svg.querySelector('.gl-selection')?.getAttribute('d')).toBe('');
		hl.destroy();
	});
});
