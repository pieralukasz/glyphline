# glyphline

Text highlights that sit on the glyphs. A sentence outline that morphs from one sentence to the
next, a word cursor that stretches along the line, the user's selection drawn as one rounded shape,
and static marks for notes or search hits. For PDF pages rendered by [pdf.js](https://mozilla.github.io/pdf.js/)
and for plain HTML.

```sh
bun add glyphline
```

Docs and live demos: https://glyphline.lucaspiera.com

## Why

- **On the glyphs, not near them.** For PDFs, word positions come from the page's own glyph stream
  and the embedded fonts' advance widths, the same way pdf.js paints the canvas. The pdf.js text
  layer uses a substitute font stretched to each span, so boxes measured on it drift inside a line.
  On the bundled stress document the median horizontal edge error is 0.00 px.
- **One shape per sentence.** A multi-line range is one rounded outline, not a stack of
  rectangles; justified line ends are snapped so the edge stays straight.
- **Motion that reads.** The word cursor stretches toward the next word and contracts onto it,
  moves between lines with the same liquid motion, and pops in and out. The sentence outline morphs
  line by line. Interrupting mid-flight continues from what is on screen.
  `prefers-reduced-motion` turns it into jumps.
- **No framework lock-in.** A framework-free core, with a React hook/component and a Svelte action.

## Quick start (HTML)

```ts
import { createHighlighter } from 'glyphline';
import { domSource } from 'glyphline/dom';
import 'glyphline/style.css';

const article = document.querySelector('article')!; // position: relative
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
article.append(svg);

const hl = createHighlighter(svg, domSource(article), { trackSelection: true });
hl.update({ sentence: 0, word: 0 });
```

## Quick start (PDF)

```ts
import { getDocument, OPS } from 'pdfjs-dist';
import { createHighlighter } from 'glyphline';
import { pdfSource } from 'glyphline/pdf';

const doc = await getDocument({ url, fontExtraProperties: true }).promise;
const page = await doc.getPage(1);
// ...render the canvas (and optionally the text layer) as usual...
const source = await pdfSource(page, { OPS });
const hl = createHighlighter(svg, source); // svg covers the page; viewBox is in page units
hl.update({ sentence: 3, word: 41 });
```

## React

```tsx
import { GlyphOverlay } from 'glyphline/react';

<div style={{ position: 'relative' }}>
	<article ref={setArticle}>…</article>
	<GlyphOverlay source={source} sentence={s} word={w} className="gl-overlay" />
</div>;
```

## Svelte

```svelte
<script>
	import { highlight } from 'glyphline/svelte';
</script>

<svg class="gl-overlay" use:highlight={{ source, sentence, word }} />
```

## Entry points

| Import | What |
| --- | --- |
| `glyphline` | `createHighlighter`, the motion interpolators, outline geometry, `segment` |
| `glyphline/pdf` | `pdfSource` for a pdf.js page, glyph walk, per-method geometry |
| `glyphline/dom` | `domSource` for HTML text |
| `glyphline/react` | `useHighlighter`, `<GlyphOverlay>` |
| `glyphline/svelte` | `highlight` action, `glyphline` attachment (Svelte 5) |
| `glyphline/style.css` | default colours as CSS custom properties |
| `glyphline/pdf.css` | the minimum CSS for the native pdf.js text layer |

`pdfjs-dist` and `react` are optional peer dependencies: install them only for the entry points
that need them.

## Development

```sh
bun install
bun run typecheck && bun run test   # Node + Chromium (Vitest browser mode)
bun run build && bun run check:package
cd docs-site && bun install && bun run build
```

Extracted from [Folio](https://folio-reader-seven-psi.vercel.app), a read-aloud PDF reader.

MIT © Łukasz Piera
