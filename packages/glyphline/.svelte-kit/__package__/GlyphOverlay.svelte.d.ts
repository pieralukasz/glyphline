import { type Highlighter, type HighlighterOptions, type HighlightState, type TextSource } from 'glyphline';
import type { SVGAttributes } from 'svelte/elements';
type Props = HighlightState & Omit<SVGAttributes<SVGSVGElement>, 'class'> & {
    /** the text to highlight; nothing is drawn while it is null */
    source: TextSource | null | undefined;
    options?: HighlighterOptions;
    class?: string;
    /** force the light or dark colours of glyphline/style.css (a white PDF page in a dark app) */
    theme?: 'light' | 'dark';
    /** the highlighter, for calls like refresh() */
    highlighter?: Highlighter | null;
};
declare const GlyphOverlay: import("svelte").Component<Props, {}, "highlighter">;
type GlyphOverlay = ReturnType<typeof GlyphOverlay>;
export default GlyphOverlay;
