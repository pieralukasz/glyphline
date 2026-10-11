# glyphline: notes for coding agents

This file ships in the npm package (`node_modules/glyphline/AGENTS.md`). Read it before writing code
that uses glyphline. Full docs as plain text: https://glyphline.lucaspiera.com/llms-full.txt

## What it is

An `<svg>` overlay that draws text highlights over text it does not own: a sentence outline, a word
cursor that animates between words, the user's selection and saved marks. Text comes from a
`TextSource`: `domSource` (HTML) or `pdfSource` (a pdf.js page).

## Imports (one package, subpaths)

```ts
import { createHighlighter, wordAtPoint } from 'glyphline'; // core
import { domSource } from 'glyphline/dom'; // HTML
import { pdfSource } from 'glyphline/pdf'; // pdf.js page; needs pdfjs-dist
import { GlyphOverlay, useDomSource, useAsyncSource } from 'glyphline/react'; // React 18/19
import { GlyphOverlay, domText, asyncText, highlight } from 'glyphline/svelte'; // Svelte 5
import 'glyphline/style.css'; // default colours, import once
import 'glyphline/pdf.css'; // only if you render the pdf.js text layer without pdf_viewer.css
```

There are no packages named `react-glyphline` or `svelte-glyphline`. Install only `glyphline`
(plus `pdfjs-dist` for PDFs).

## Rules that are easy to get wrong

1. The overlay must sit inside a positioned element (`position: relative`) that wraps exactly the
   text. `GlyphOverlay` and the `gl-overlay` class stretch the svg over that parent.
2. Indices (`word`, `sentence`) are into `source.words` / `source.sentences` of that source. After
   the text changes, use a new source (`useDomSource` / `domText` rebuild it for you).
3. Targets can also be character ranges `{ start, end }` (end exclusive) into `source.text`.
4. Sources read the DOM or pdf.js: create them in the browser only (effects, refs, attachments),
   never during SSR. The React entry is marked `"use client"`.
5. PDF: call `getDocument({ url, fontExtraProperties: true })`. Without it the glyph positions fall
   back to a less precise method. Pass `OPS` from `pdfjs-dist` to `pdfSource`.
6. PDF boxes are in page units at scale 1; the svg `viewBox` is the page size. Do not multiply by the
   zoom yourself: size the page element and the overlay scales.
7. For selections inside a PDF, call `source.withTextLayer(textLayer.textDivs, layerEl, scale)` after
   rendering pdf.js `TextLayer`, and pass the returned source.
8. To draw the selection: `options={{ trackSelection: { snapToWords: true, onChange } }}`; add class
   `gl-native-selection-hidden` to the text element to hide the browser's own colour.
9. A white PDF page inside a dark app: `theme="light"` on `GlyphOverlay`.
10. Click to word: `wordAtPoint(source, svgElement, e.clientX, e.clientY)` returns a word index or -1.
    Skip it when `document.getSelection()?.isCollapsed` is false (the user is selecting).

## Minimal examples

React:

```tsx
const [ref, source] = useDomSource<HTMLElement>();
<div style={{ position: 'relative' }}>
	<article ref={ref}>…</article>
	<GlyphOverlay source={source} sentence={s} word={w} />
</div>;
```

Svelte 5:

```svelte
<script lang="ts">
	import { domText, GlyphOverlay } from 'glyphline/svelte';
	const text = domText();
</script>

<div style="position: relative">
	<article {@attach text.attach}>…</article>
	<GlyphOverlay source={text.source} {sentence} {word} />
</div>
```

No framework:

```ts
const hl = createHighlighter(svg, domSource(article), { trackSelection: true });
hl.update({ sentence: 0, word: 0 });
hl.destroy(); // when done
```
