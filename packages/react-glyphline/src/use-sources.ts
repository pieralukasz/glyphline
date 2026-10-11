import type { TextSource } from 'glyphline';
import { type DomSourceOptions, type DomTextSource, watchDomSource } from 'glyphline/dom';
import { type RefCallback, useCallback, useEffect, useRef, useState } from 'react';

/**
 * A text source for the element the returned ref is attached to. It is rebuilt when the
 * element's text changes (React re-rendered other children), so indices always match the DOM.
 *
 * ```tsx
 * const [ref, source] = useDomSource<HTMLElement>();
 * <article ref={ref}>…</article>
 * <GlyphOverlay source={source} word={word} />
 * ```
 */
export function useDomSource<E extends Element = HTMLElement>(
	options?: DomSourceOptions
): [RefCallback<E>, DomTextSource | null] {
	const [source, setSource] = useState<DomTextSource | null>(null);
	const stop = useRef<(() => void) | null>(null);
	const opts = useRef(options);
	opts.current = options;
	const ref = useCallback<RefCallback<E>>((el) => {
		stop.current?.();
		stop.current = null;
		if (!el) {
			setSource(null);
			return;
		}
		stop.current = watchDomSource(el, setSource, opts.current);
	}, []);
	useEffect(() => () => stop.current?.(), []);
	return [ref, source];
}

/**
 * Resolve an async source (a PDF page) once its inputs change, dropping results that arrive after
 * a newer request. `make` returns null to mean "nothing yet".
 *
 * ```tsx
 * const source = useAsyncSource(() => page && pdfSource(page, { OPS }), [page]);
 * ```
 */
export function useAsyncSource<S extends TextSource>(
	make: () => Promise<S> | S | null | undefined,
	deps: readonly unknown[]
): S | null {
	const [source, setSource] = useState<S | null>(null);
	const run = useRef(0);
	const latest = useRef(make);
	latest.current = make;
	const effect = () => {
		const id = ++run.current;
		const out = latest.current();
		if (!out) {
			setSource(null);
			return;
		}
		void Promise.resolve(out).then((s) => {
			if (id === run.current) setSource(s);
		});
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: the caller lists the inputs, like useMemo
	useEffect(effect, deps);
	return source;
}
