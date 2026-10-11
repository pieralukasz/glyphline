import type { TextSource } from 'glyphline';
import { type DomSourceOptions, type DomTextSource } from 'glyphline/dom';
import type { Attachment } from 'svelte/attachments';
/**
 * A reactive text source for an element, rebuilt when its text changes.
 *
 * ```svelte
 * <script>
 *   const text = domText();
 * </script>
 * <article {@attach text.attach}>…</article>
 * <GlyphOverlay source={text.source} {word} />
 * ```
 */
export declare function domText(options?: DomSourceOptions): {
    readonly source: DomTextSource | null;
    attach: Attachment<Element>;
};
/**
 * Resolve an async source (a PDF page) whenever what `make` reads changes; results that arrive
 * after a newer request are dropped. Call it during component setup.
 *
 * ```svelte
 * const text = asyncText(() => page && pdfSource(page, { OPS }));
 * <GlyphOverlay source={text.source} />
 * ```
 */
export declare function asyncText<S extends TextSource>(make: () => Promise<S> | S | null | undefined): {
    readonly source: S | null;
};
