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
- **React and Svelte packages** on a framework-free core that works anywhere.

## Packages

| Package | For | Docs |
| --- | --- | --- |
| [`react-glyphline`](packages/react-glyphline) | React 18 and 19 | https://glyphline.lucaspiera.com/docs/react |
| [`svelte-glyphline`](packages/svelte-glyphline) | Svelte 5 | https://glyphline.lucaspiera.com/docs/svelte |
| [`glyphline`](packages/glyphline) | the framework-free core | https://glyphline.lucaspiera.com/docs/api |

### React

```sh
bun add react-glyphline
```

```tsx
import { GlyphOverlay, useDomSource } from 'react-glyphline';
import 'glyphline/style.css';

const [ref, source] = useDomSource<HTMLElement>();

<div style={{ position: 'relative' }}>
	<article ref={ref}>…</article>
	<GlyphOverlay source={source} sentence={s} word={w} />
</div>;
```

### Svelte 5

```sh
bun add svelte-glyphline
```

```svelte
<script lang="ts">
	import { domText, GlyphOverlay } from 'svelte-glyphline';
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

| Core import | What |
| --- | --- |
| `glyphline` | `createHighlighter`, the motion interpolators, outline geometry, `segment`, `wordAtPoint` |
| `glyphline/pdf` | `pdfSource` for a pdf.js page, glyph walk, per-method geometry |
| `glyphline/dom` | `domSource`, `watchDomSource` for HTML text |
| `glyphline/style.css` | default colours as CSS custom properties |
| `glyphline/pdf.css` | the minimum CSS for the native pdf.js text layer |

## Development

A bun workspace: `packages/glyphline` (core), `packages/react-glyphline`, `packages/svelte-glyphline`, and `docs-site` (Fumadocs).

```sh
bun install
bun run build                        # core first, then the framework packages
bun run typecheck && bun run test    # every package; Node + Chromium (Vitest browser mode)
bun run check:package && bun run lint
cd docs-site && bun install && bun run build
```

Extracted from [Folio](https://folio-reader-seven-psi.vercel.app), a read-aloud PDF reader.

MIT © Łukasz Piera
