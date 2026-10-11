import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { TextSource } from '../../src/core/source.ts';
import { domSource } from '../../src/dom/source.ts';
import { GlyphOverlay } from '../../src/react/highlighter.tsx';

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
});
