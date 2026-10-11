import { domSource } from 'glyphline/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { glyphline, highlight } from '../src/lib/action.js';

afterEach(() => {
	document.body.innerHTML = '';
});

const setup = () => {
	const host = document.createElement('div');
	host.style.position = 'relative';
	host.innerHTML = '<p>One two three. Four five.</p>';
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	host.append(svg);
	document.body.append(host);
	return { source: domSource(host.querySelector('p') as HTMLElement), svg };
};

describe('Svelte adapter (plain action contract)', () => {
	it('action: mounts, updates and destroys', () => {
		const { source, svg } = setup();
		const a = highlight(svg, { source, word: 0, options: { animate: false } });
		const d0 = svg.querySelector('.gl-word')?.getAttribute('d');
		a.update({ source, word: 2, options: { animate: false } });
		expect(svg.querySelector('.gl-word')?.getAttribute('d')).not.toBe(d0);
		a.destroy();
		expect(svg.childElementCount).toBe(0);
	});

	it('action: waits for a source that loads later', () => {
		const { source, svg } = setup();
		const a = highlight(svg, { source: null, word: 0 });
		expect(svg.childElementCount).toBe(0);
		a.update({ source, word: 0, options: { animate: false } });
		expect(svg.querySelector('.gl-word')?.getAttribute('d')).toMatch(/^M/);
		a.destroy();
	});

	it('attachment: returns a cleanup', () => {
		const { source, svg } = setup();
		const cleanup = glyphline({ source, sentence: 1, options: { animate: false } })(svg);
		expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toMatch(/^M/);
		cleanup();
		expect(svg.childElementCount).toBe(0);
	});
});
