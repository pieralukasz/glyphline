<script lang="ts">
import type { Mark, TextRange } from "glyphline";
import { domText, GlyphOverlay } from "svelte-glyphline";

const text = domText();
let word = $state(-1);
let playing = $state(false);
let selected = $state<{ range: TextRange; text: string } | null>(null);
let marks = $state<Mark[]>([]);

const sentence = $derived(
  text.source && word >= 0 ? (text.source.words[word]?.sentence ?? -1) : -1,
);

$effect(() => {
  if (!playing || !text.source) return;
  const n = text.source.words.length;
  const id = setInterval(() => (word = (word + 1) % n), 260);
  return () => clearInterval(id);
});

const options = {
  trackSelection: {
    snapToWords: true,
    onChange: (range: TextRange | null, t: string) =>
      (selected = range ? { range, text: t } : null),
  },
};

function keep() {
  if (!selected) return;
  marks = [...marks, { id: crypto.randomUUID(), ...selected.range }];
  document.getSelection()?.removeAllRanges();
}
</script>

<div class="gl-demo">
  <div class="gl-toolbar">
    <button type="button" class="gl-btn is-primary" onclick={() => (playing = !playing)}>
      {playing ? "Pause" : "Read"}
    </button>
    <button type="button" class="gl-btn" disabled={!selected} onmousedown={(e) => e.preventDefault()} onclick={keep}>
      Highlight selection
    </button>
    {#if marks.length}
      <button type="button" class="gl-btn" onclick={() => (marks = [])}>Clear {marks.length}</button>
    {/if}
    <span class="gl-status">Rendered by Svelte 5</span>
  </div>
  <div class="gl-article-wrap" data-svelte-demo>
    <div class="gl-article gl-native-selection-hidden" lang="en" {@attach text.attach}>
      <p>
        Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look
        about her and to wonder what was going to happen next.
      </p>
      <p>Select some words, or press <em>Read</em>.</p>
    </div>
    <GlyphOverlay source={text.source} {word} {sentence} {marks} {options} />
  </div>
</div>
