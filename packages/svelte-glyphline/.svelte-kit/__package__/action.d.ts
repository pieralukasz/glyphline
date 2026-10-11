import { type HighlighterOptions, type HighlightState, type TextSource } from 'glyphline';
export type GlyphlineParams = HighlightState & {
    source: TextSource | null | undefined;
    options?: HighlighterOptions;
};
/**
 * Svelte action for an `<svg>` overlay: `<svg use:highlight={{ source, sentence, word }} />`.
 * Works in Svelte 4 and 5. `<GlyphOverlay>` is the same thing as a component.
 */
export declare function highlight(svg: SVGSVGElement, params: GlyphlineParams): {
    update: (p: GlyphlineParams) => void;
    destroy(): void;
};
/** Svelte 5 attachment: `<svg {@attach glyphline({ source, sentence, word })} />`. */
export declare const glyphline: (params: GlyphlineParams) => (svg: SVGSVGElement) => () => void;
