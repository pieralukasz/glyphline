// Copied from docs-site/content/docs/react/index.mdx
import { GlyphOverlay, useDomSource } from 'glyphline/react';
import 'glyphline/style.css';

export function Article({ word, sentence }: { word: number; sentence: number }) {
	const [ref, source] = useDomSource<HTMLElement>();
	return (
		<div style={{ position: 'relative' }}>
			<article ref={ref}>
				<p>Alice was beginning to get very tired of sitting by her sister on the bank…</p>
			</article>
			<GlyphOverlay source={source} sentence={sentence} word={word} />
		</div>
	);
}
