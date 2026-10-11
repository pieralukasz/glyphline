import type { TextSource } from 'glyphline';
import { domSource } from 'glyphline/dom';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { GlyphOverlay, useAsyncSource, useDomSource } from '../src/index.ts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	document.body.innerHTML = '';
});

describe('React adapter', () => {
	it('draws, follows prop changes and cleans up on unmount', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		let setWord: (n: number) => void = () => {};
		let svgCountAfter = -1;
		function App() {
			const [source, setSource] = useState<TextSource | null>(null);
			const [word, set] = useState(0);
			setWord = set;
			return (
				<div style={{ position: 'relative' }}>
					<p
						ref={(el) => {
							if (el && !source) setSource(domSource(el));
						}}
					>
						One two three. Four five.
					</p>
					<GlyphOverlay
						source={source}
						sentence={word < 3 ? 0 : 1}
						word={word}
						options={{ animate: false }}
						className="gl-overlay"
					/>
				</div>
			);
		}
		const root = createRoot(host);
		await act(async () => root.render(<App />));
		const svg = host.querySelector('svg') as SVGSVGElement;
		const d0 = svg.querySelector('.gl-word')?.getAttribute('d');
		expect(d0).toMatch(/^M/);
		await act(async () => setWord(3));
		const d1 = svg.querySelector('.gl-word')?.getAttribute('d');
		expect(d1).toMatch(/^M/);
		expect(d1).not.toBe(d0);
		await act(async () => root.unmount());
		svgCountAfter = svg.childElementCount;
		expect(svgCountAfter).toBe(0);
	});

	it('useDomSource follows text React renders into the element', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		let setCount: (n: number) => void = () => {};
		let seen: string[] = [];
		function App() {
			const [n, set] = useState(1);
			setCount = set;
			const [ref, source] = useDomSource<HTMLDivElement>();
			seen = source ? [...seen, source.text] : seen;
			return (
				<div style={{ position: 'relative' }}>
					<div ref={ref}>
						{Array.from({ length: n }, (_, i) => i + 1).map((line) => (
							<p key={line}>Line {line}.</p>
						))}
					</div>
					<GlyphOverlay source={source} sentence={n - 1} options={{ animate: false }} />
				</div>
			);
		}
		const root = createRoot(host);
		await act(async () => root.render(<App />));
		expect(seen.at(-1)).toBe('Line 1.');
		await act(async () => setCount(3));
		await act(
			async () =>
				new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
		);
		expect(seen.at(-1)).toBe('Line 1.\nLine 2.\nLine 3.');
		expect(host.querySelector('.gl-sentence')?.getAttribute('d')).toMatch(/^M/);
		await act(async () => root.unmount());
	});

	it('useAsyncSource drops a result that arrives after a newer request', async () => {
		const host = document.createElement('div');
		document.body.append(host);
		const p = document.createElement('p');
		p.textContent = 'x';
		const make = (label: string, ms: number) =>
			new Promise<TextSource>((r) => setTimeout(() => r({ ...domSource(p), text: label }), ms));
		let setKey: (k: string) => void = () => {};
		let last: string | null = null;
		function App() {
			const [key, set] = useState('slow');
			setKey = set;
			const s = useAsyncSource(() => make(key, key === 'slow' ? 80 : 10), [key]);
			last = s?.text ?? null;
			return null;
		}
		const root = createRoot(host);
		await act(async () => root.render(<App />));
		await act(async () => setKey('fast'));
		await act(async () => new Promise((r) => setTimeout(r, 150)));
		expect(last).toBe('fast');
		await act(async () => root.unmount());
	});
});
