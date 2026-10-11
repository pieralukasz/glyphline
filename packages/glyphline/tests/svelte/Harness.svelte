<script lang="ts">
import type { HighlighterOptions } from 'glyphline';
import { domText, GlyphOverlay } from '../../src/svelte/index.js';

let { word = 0, lines = 1, options = { animate: false } as HighlighterOptions } = $props();
const text = domText();
</script>

<div style="position: relative">
	<div {@attach text.attach} data-testid="text">
		{#each Array.from({ length: lines }, (_, i) => i) as i (i)}
			<p>Line {i + 1} one two three.</p>
		{/each}
	</div>
	<GlyphOverlay source={text.source} {word} sentence={lines - 1} {options} />
</div>
<output data-testid="text-length">{text.source?.text.length ?? -1}</output>
