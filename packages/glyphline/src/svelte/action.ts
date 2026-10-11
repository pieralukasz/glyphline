import {
	createHighlighter,
	type Highlighter,
	type HighlighterOptions,
	type HighlightState,
	type TextSource
} from 'glyphline';

export type GlyphlineParams = HighlightState & {
	source: TextSource | null | undefined;
	options?: HighlighterOptions;
};

/**
 * Svelte action for an `<svg>` overlay: `<svg use:highlight={{ source, sentence, word }} />`.
 * Works in Svelte 4 and 5. `<GlyphOverlay>` is the same thing as a component.
 */
export function highlight(svg: SVGSVGElement, params: GlyphlineParams) {
	let hl: Highlighter | null = null;
	let source: TextSource | null | undefined;

	const apply = (p: GlyphlineParams) => {
		const { source: s, options, ...state } = p;
		if (!s) {
			hl?.destroy();
			hl = null;
			source = s;
			return;
		}
		if (!hl) {
			hl = createHighlighter(svg, s, options);
		} else {
			if (s !== source) hl.setSource(s);
			hl.setOptions(options ?? {});
		}
		source = s;
		const next: HighlightState = {
			sentence: state.sentence,
			word: state.word,
			marks: state.marks
		};
		if ('selection' in state) next.selection = state.selection;
		hl.update(next);
	};

	svg.setAttribute('preserveAspectRatio', 'none');
	apply(params);
	return {
		update: apply,
		destroy() {
			hl?.destroy();
			hl = null;
		}
	};
}

/** Svelte 5 attachment: `<svg {@attach glyphline({ source, sentence, word })} />`. */
export const glyphline = (params: GlyphlineParams) => (svg: SVGSVGElement) => {
	const a = highlight(svg, params);
	return () => a.destroy();
};
