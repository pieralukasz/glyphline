<script lang="ts">
import {
	createHighlighter,
	type Highlighter,
	type HighlighterOptions,
	type HighlightState,
	type TextSource
} from 'glyphline';
import type { SVGAttributes } from 'svelte/elements';

type Props = HighlightState &
	Omit<SVGAttributes<SVGSVGElement>, 'class'> & {
		/** the text to highlight; nothing is drawn while it is null */
		source: TextSource | null | undefined;
		options?: HighlighterOptions;
		class?: string;
		/** force the light or dark colours of glyphline/style.css (a white PDF page in a dark app) */
		theme?: 'light' | 'dark';
		/** the highlighter, for calls like refresh() */
		highlighter?: Highlighter | null;
	};

let {
	source,
	sentence,
	word,
	marks,
	selection,
	options,
	class: className,
	theme,
	highlighter = $bindable(null),
	...rest
}: Props = $props();

let svg: SVGSVGElement;
const prefix = $derived(options?.classPrefix ?? 'gl');

// one highlighter per source element; a new source swaps the text in place
$effect(() => {
	const s = source;
	if (!s) return;
	const hl = createHighlighter(svg, s, $state.snapshot(options) as HighlighterOptions);
	highlighter = hl;
	return () => {
		hl.destroy();
		highlighter = null;
	};
});

$effect(() => {
	// read before the guard so the effect tracks the options even with no highlighter yet
	const o = options ?? {};
	highlighter?.setOptions(o);
});

$effect(() => {
	const next: HighlightState = { sentence, word, marks };
	// `selection` is left to trackSelection unless the caller passes it
	if (selection !== undefined) next.selection = selection;
	highlighter?.update(next);
});
</script>

<svg
	bind:this={svg}
	{...rest}
	class={className ? `${prefix}-overlay ${className}` : `${prefix}-overlay`}
	data-gl-theme={theme}
	preserveAspectRatio="none"
	aria-hidden="true"
></svg>
