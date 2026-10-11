import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Harness from './Harness.svelte';

afterEach(() => {
	document.body.innerHTML = '';
});

const frames = () =>
	new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

describe('GlyphOverlay.svelte with domText', () => {
	it('draws, follows props, rebuilds on new text and cleans up', async () => {
		const props = $state({ word: 0, lines: 1 });
		const app = mount(Harness, { target: document.body, props });
		flushSync();
		const svg = document.querySelector('svg.gl-overlay') as SVGSVGElement;
		const d0 = svg.querySelector('.gl-word')?.getAttribute('d');
		expect(d0).toMatch(/^M/);

		props.word = 2;
		flushSync();
		expect(svg.querySelector('.gl-word')?.getAttribute('d')).not.toBe(d0);

		props.lines = 3;
		flushSync();
		await frames();
		flushSync();
		const length = Number(document.querySelector('[data-testid="text-length"]')?.textContent);
		expect(length).toBeGreaterThan(60);
		expect(svg.querySelector('.gl-sentence')?.getAttribute('d')).toMatch(/^M/);

		unmount(app);
		expect(svg.isConnected).toBe(false);
	});
});
