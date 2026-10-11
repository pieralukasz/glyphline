import type { TextSource } from 'glyphline';
import { type DomSourceOptions, type DomTextSource, watchDomSource } from 'glyphline/dom';
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
export function domText(options?: DomSourceOptions) {
	let source = $state.raw<DomTextSource | null>(null);
	const attach: Attachment<Element> = (el) => {
		const stop = watchDomSource(
			el,
			(s) => {
				source = s;
			},
			options
		);
		return () => {
			stop();
			source = null;
		};
	};
	return {
		get source() {
			return source;
		},
		attach
	};
}

/**
 * Resolve an async source (a PDF page) whenever what `make` reads changes; results that arrive
 * after a newer request are dropped. Call it during component setup.
 *
 * ```svelte
 * const text = asyncText(() => page && pdfSource(page, { OPS }));
 * <GlyphOverlay source={text.source} />
 * ```
 */
export function asyncText<S extends TextSource>(make: () => Promise<S> | S | null | undefined) {
	let source = $state.raw<S | null>(null);
	let run = 0;
	$effect(() => {
		const id = ++run;
		const out = make();
		if (!out) {
			source = null;
			return;
		}
		void Promise.resolve(out).then((s) => {
			if (id === run) source = s;
		});
	});
	return {
		get source() {
			return source;
		}
	};
}
