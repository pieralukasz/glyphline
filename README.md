# glyphline

Text highlights that sit on the glyphs. A sentence outline that morphs from one sentence to the
next, a word cursor that stretches along the line, the user's selection drawn as one rounded shape,
and static marks for notes or search hits. For PDF pages rendered by [pdf.js](https://mozilla.github.io/pdf.js/)
and for plain HTML.

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
- **One package for React, Svelte 5 and plain TypeScript**: `glyphline/react` and `glyphline/svelte` on a framework-free core.

## Install

```sh
bun add glyphline
```

One package: the core plus React and Svelte 5 adapters as subpath imports. `react`, `svelte` and `pdfjs-dist` are optional peers, so you install only what your app uses.

### React

```tsx
import { GlyphOverlay, useDomSource } from 'glyphline/react';
import 'glyphline/style.css';

const [ref, source] = useDomSource<HTMLElement>();

<div style={{ position: 'relative' }}>
	<article ref={ref}>…</article>
	<GlyphOverlay source={source} sentence={s} word={w} />
</div>;
```

### Svelte 5

```svelte
<script lang="ts">
	import { domText, GlyphOverlay } from 'glyphline/svelte';
	import 'glyphline/style.css';

	const text = domText();
</script>

<div style="position: relative">
	<article {@attach text.attach}>…</article>
	<GlyphOverlay source={text.source} {sentence} {word} />
</div>
```

### No framework, or a PDF page

```ts
import { getDocument, OPS } from 'pdfjs-dist';
import { createHighlighter } from 'glyphline';
import { pdfSource } from 'glyphline/pdf'; // or domSource from 'glyphline/dom'

const doc = await getDocument({ url, fontExtraProperties: true }).promise;
const source = await pdfSource(await doc.getPage(1), { OPS });
const hl = createHighlighter(svg, source); // svg covers the page; viewBox is in page units
hl.update({ sentence: 3, word: 41 });
```

| Import | What |
| --- | --- |
| `glyphline` | `createHighlighter`, the motion interpolators, outline geometry, `segment`, `wordAtPoint` |
| `glyphline/pdf` | `pdfSource` for a pdf.js page, glyph walk, per-method geometry |
| `glyphline/dom` | `domSource`, `watchDomSource` for HTML text |
| `glyphline/react` | `GlyphOverlay`, `useHighlighter`, `useDomSource`, `useAsyncSource` |
| `glyphline/svelte` | `GlyphOverlay` (component), `domText`, `asyncText`, `highlight` action, `glyphline` attachment |
| `glyphline/style.css` | default colours as CSS custom properties |
| `glyphline/pdf.css` | the minimum CSS for the native pdf.js text layer |

## Development

A bun workspace: `packages/glyphline` (the published package: `src/core`, `src/pdf`, `src/dom`, `src/react`, `src/svelte`) and `docs-site` (Fumadocs).

```sh
bun install
bun run build                        # tsdown + svelte-package
bun run typecheck && bun run test    # tsc + svelte-check; Node + Chromium (core, React, Svelte)
bun run check:package && bun run lint
cd docs-site && bun install && bun run build
```

Extracted from [Folio](https://folio-reader-seven-psi.vercel.app), a read-aloud PDF reader.

MIT © Łukasz Piera
