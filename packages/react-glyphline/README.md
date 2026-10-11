# react-glyphline

React bindings for [glyphline](https://glyphline.lucaspiera.com): a sentence outline that morphs, a word cursor that glides, the selection drawn as one shape and saved marks, over pdf.js pages and HTML text.

```sh
bun add react-glyphline
```

```tsx
import { GlyphOverlay, useDomSource } from 'react-glyphline';
import 'glyphline/style.css';

export function Article({ sentence, word }: { sentence: number; word: number }) {
	const [ref, source] = useDomSource<HTMLElement>();
	return (
		<div style={{ position: 'relative' }}>
			<article ref={ref}>…</article>
			<GlyphOverlay source={source} sentence={sentence} word={word} />
		</div>
	);
}
```

Exports: `GlyphOverlay`, `useHighlighter`, `useDomSource`, `useAsyncSource` (for `pdfSource`). React 18 or 19; marked `"use client"` for Next.js.

Docs: https://glyphline.lucaspiera.com/docs/react

MIT © Łukasz Piera
