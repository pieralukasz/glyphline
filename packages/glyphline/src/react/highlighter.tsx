import {
	createHighlighter,
	type Highlighter,
	type HighlighterOptions,
	type HighlightState,
	type TextSource
} from 'glyphline';
import {
	type CSSProperties,
	type RefCallback,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef
} from 'react';

// useLayoutEffect warns during SSR; the highlighter only runs in the browser anyway
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Attach a highlighter to an `<svg>`. Returns a ref for the svg; the highlights follow `state`.
 * `source` may be null while the text loads.
 */
export function useHighlighter(
	source: TextSource | null,
	state: HighlightState,
	options: HighlighterOptions = {}
): RefCallback<SVGSVGElement> {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const hl = useRef<Highlighter | null>(null);
	const latest = useRef({ source, state, options });
	latest.current = { source, state, options };

	const mount = useCallback(() => {
		hl.current?.destroy();
		hl.current = null;
		const { source: s, state: st, options: o } = latest.current;
		if (!svgRef.current || !s) return;
		hl.current = createHighlighter(svgRef.current, s, o);
		hl.current.update(st);
	}, []);

	const ref = useCallback<RefCallback<SVGSVGElement>>(
		(el) => {
			svgRef.current = el;
			mount();
		},
		[mount]
	);

	useIsoLayoutEffect(() => {
		if (!hl.current) mount();
		else if (source) hl.current.setSource(source);
	}, [source, mount]);

	// setOptions is cheap when nothing visual changed, so an inline options object is fine
	useIsoLayoutEffect(() => {
		hl.current?.setOptions(options);
	});

	const { sentence, word, marks, selection } = state;
	useIsoLayoutEffect(() => {
		const next: HighlightState = { sentence, word, marks };
		if ('selection' in latest.current.state) next.selection = selection;
		hl.current?.update(next);
	}, [sentence, word, marks, selection]);

	useEffect(
		() => () => {
			hl.current?.destroy();
			hl.current = null;
		},
		[]
	);

	return ref;
}

export type GlyphOverlayProps = HighlightState & {
	source: TextSource | null;
	options?: HighlighterOptions;
	className?: string;
	style?: CSSProperties;
	/**
	 * Force the light or dark colours of `glyphline/style.css`. A PDF page stays white in a dark
	 * site, so its overlay wants "light".
	 */
	theme?: 'light' | 'dark';
};

/**
 * An `<svg>` overlay with the highlights. Place it inside a positioned element that wraps the
 * text; the default `gl-overlay` class from `glyphline/style.css` stretches it over its parent.
 */
export function GlyphOverlay({
	source,
	options,
	className,
	style,
	theme,
	...state
}: GlyphOverlayProps) {
	const ref = useHighlighter(source, state, options);
	// keep the overlay class the highlighter adds: React owns the class attribute
	const base = `${options?.classPrefix ?? 'gl'}-overlay`;
	return (
		<svg
			ref={ref}
			className={className ? `${base} ${className}` : base}
			style={style}
			data-gl-theme={theme}
			preserveAspectRatio="none"
			aria-hidden="true"
		/>
	);
}
