# glyphline

Text highlights that sit on the glyphs: a sentence outline that morphs, a word cursor that glides, the selection drawn as one shape and saved marks. For pdf.js pages (positions from the embedded fonts) and HTML. Framework-free.

Using React or Svelte? Install [`react-glyphline`](https://www.npmjs.com/package/react-glyphline) or [`svelte-glyphline`](https://www.npmjs.com/package/svelte-glyphline) instead; they bring this package with them.

```sh
bun add glyphline
```

```ts
import { createHighlighter } from 'glyphline';
import { domSource } from 'glyphline/dom';
import 'glyphline/style.css';

const hl = createHighlighter(svg, domSource(article), { trackSelection: true });
hl.update({ sentence: 0, word: 0 });
```

Docs: https://glyphline.lucaspiera.com

MIT © Łukasz Piera
