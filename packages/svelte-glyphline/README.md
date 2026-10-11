# svelte-glyphline

Svelte 5 bindings for [glyphline](https://glyphline.lucaspiera.com): a sentence outline that morphs, a word cursor that glides, the selection drawn as one shape and saved marks, over pdf.js pages and HTML text.

```sh
bun add svelte-glyphline
```

```svelte
<script lang="ts">
	import { domText, GlyphOverlay } from 'svelte-glyphline';
	import 'glyphline/style.css';

	let { sentence, word }: { sentence: number; word: number } = $props();
	const text = domText();
</script>

<div style="position: relative">
	<article {@attach text.attach}>…</article>
	<GlyphOverlay source={text.source} {sentence} {word} />
</div>
```

Exports: `GlyphOverlay` (component), `domText` and `asyncText` (reactive sources), `highlight` (action, also Svelte 4) and `glyphline` (attachment).

Docs: https://glyphline.lucaspiera.com/docs/svelte

MIT © Łukasz Piera
