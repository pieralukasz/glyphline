<!-- Copied from docs-site/content/docs/svelte/selection.mdx -->
<script lang="ts">
import type { Mark, TextRange } from 'glyphline';
import { domText, GlyphOverlay } from 'glyphline/svelte';

const text = domText();
let selected = $state<{ range: TextRange; text: string } | null>(null);
let marks = $state<Mark[]>([]);

const options = {
	trackSelection: {
		snapToWords: true,
		onChange: (range: TextRange | null, t: string) => (selected = range ? { range, text: t } : null)
	}
};

function keep() {
	if (!selected) return;
	marks = [...marks, { id: crypto.randomUUID(), ...selected.range, className: 'note' }];
	document.getSelection()?.removeAllRanges();
}
</script>

<!-- preventDefault on mousedown keeps the selection alive while the button is pressed -->
<button disabled={!selected} onmousedown={(e) => e.preventDefault()} onclick={keep}>Highlight</button>

<div style="position: relative">
  <div class="gl-native-selection-hidden" {@attach text.attach}>…</div>
  <GlyphOverlay source={text.source} {marks} {options} />
</div>
