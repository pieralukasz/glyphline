import { afterEach, expect, it, vi } from 'vitest';
import { createHighlighter } from '../../src/core/highlighter.ts';
import { sentenceShape, shapePath, wordPath } from '../../src/core/outline.ts';
import { segment } from '../../src/core/segment.ts';
import type { TextSource } from '../../src/core/source.ts';

const boxes = [
	{ x: 10, y: 10, w: 60, h: 20 },
	{ x: 100, y: 350, w: 60, h: 20 }
];
const source: TextSource = {
	text: 'One. Two.',
	...segment('One. Two.'),
	boxes: (start) => [boxes[start === 0 ? 0 : 1]],
	viewBox: () => ({ x: 0, y: 0, w: 400, h: 500 })
};

function mount(reduced = false) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	document.body.append(svg);
	let now = 0;
	let id = 0;
	const frames = new Map<number, FrameRequestCallback>();
	vi.spyOn(performance, 'now').mockImplementation(() => now);
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		frames.set(++id, cb);
		return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
	const tick = (time: number) => {
		now = time;
		const pending = [...frames.values()];
		frames.clear();
		for (const cb of pending) cb(now);
	};
	const hl = createHighlighter(svg, source, { animate: false });
	hl.update({ word: 0, sentence: 0 });
	hl.setOptions({});
	return { svg, hl, tick, frames };
}
afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.replaceChildren();
});

it('finishes default long word and sentence relocations together within 180ms', () => {
	const { svg, hl, tick, frames } = mount();
	hl.update({ word: 1, sentence: 1 });
	tick(180);
	for (const kind of ['word', 'sentence'])
		expect((svg.querySelector(`.gl-${kind}`) as SVGPathElement).style.opacity).toBe('1');
	expect(frames.size).toBe(0);
	expect(svg.querySelector('.gl-word')?.getAttribute('d')).toBe(wordPath(boxes[1]));
	expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toBe(
		shapePath(sentenceShape([boxes[1]]))
	);
	hl.destroy();
});

it('retargets a partially faded jump without flashing or leaving an old RAF active', () => {
	const { svg, hl, tick, frames } = mount();
	hl.update({ word: 1, sentence: 1 });
	tick(20);
	const paths = [...svg.querySelectorAll<SVGPathElement>('.gl-word, .gl-sentence')];
	const visible = paths.map((p) => ({ d: p.getAttribute('d'), o: p.style.opacity }));
	for (const p of paths) expect(Number(p.style.opacity)).toBeGreaterThan(0);
	for (const p of paths) expect(Number(p.style.opacity)).toBeLessThan(1);
	hl.update({ word: 0, sentence: 0 });
	expect(paths.map((p) => ({ d: p.getAttribute('d'), o: p.style.opacity }))).toEqual(visible);
	expect(frames.size).toBe(2);
	tick(400);
	expect(frames.size).toBe(0);
	expect(svg.querySelector('.gl-word')?.getAttribute('d')).toBe(wordPath(boxes[0]));
	for (const p of paths) expect(p.style.opacity).toBe('1');
	hl.destroy();
});

it('honours explicit jump durations instead of imposing the 180ms default', () => {
	const { svg, hl, tick, frames } = mount();
	hl.setOptions({ duration: { word: 400, sentence: 400 } });
	hl.update({ word: 1, sentence: 1 });
	tick(180);
	expect(frames.size).toBe(2);
	for (const kind of ['word', 'sentence'])
		expect(Number((svg.querySelector(`.gl-${kind}`) as SVGPathElement).style.opacity)).toBeLessThan(
			1
		);
	tick(400);
	expect(frames.size).toBe(0);
	hl.destroy();
});

it('jumps directly to exact geometry without RAF under reduced motion', () => {
	const { svg, hl, frames } = mount(true);
	hl.update({ word: 1, sentence: 1 });
	expect(frames.size).toBe(0);
	expect(svg.querySelector('.gl-word')?.getAttribute('d')).toBe(wordPath(boxes[1]));
	expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toBe(
		shapePath(sentenceShape([boxes[1]]))
	);
	hl.destroy();
});

it('keeps the default settled word corner inside the sentence at a shared endpoint', () => {
	const { svg, hl } = mount();
	const outer = svg.querySelector('.gl-sentence') as SVGPathElement;
	const inner = svg.querySelector('.gl-word') as SVGPathElement;
	for (let y = 8; y <= 15; y += 0.125) {
		for (let x = 65; x <= 72; x += 0.125) {
			const point = new DOMPoint(x, y);
			if (inner.isPointInFill(point)) expect(outer.isPointInFill(point)).toBe(true);
		}
	}
	hl.destroy();
});
