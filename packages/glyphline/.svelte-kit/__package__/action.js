import { createHighlighter } from 'glyphline';
/**
 * Svelte action for an `<svg>` overlay: `<svg use:highlight={{ source, sentence, word }} />`.
 * Works in Svelte 4 and 5. `<GlyphOverlay>` is the same thing as a component.
 */
export function highlight(svg, params) {
    let hl = null;
    let source;
    const apply = (p) => {
        const { source: s, options, ...state } = p;
        if (!s) {
            hl?.destroy();
            hl = null;
            source = s;
            return;
        }
        if (!hl) {
            hl = createHighlighter(svg, s, options);
        }
        else {
            if (s !== source)
                hl.setSource(s);
            hl.setOptions(options ?? {});
        }
        source = s;
        const next = {
            sentence: state.sentence,
            word: state.word,
            marks: state.marks
        };
        if ('selection' in state)
            next.selection = state.selection;
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
export const glyphline = (params) => (svg) => {
    const a = highlight(svg, params);
    return () => a.destroy();
};
