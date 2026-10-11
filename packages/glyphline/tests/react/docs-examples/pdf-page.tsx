// Copied from docs-site/content/docs/react/pdf.mdx; tsc keeps the docs example compiling.
'use client';
import { type PdfTextSource, pdfSource } from 'glyphline/pdf';
import { GlyphOverlay, useAsyncSource } from 'glyphline/react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { OPS, TextLayer } from 'pdfjs-dist';
import { useEffect, useRef, useState } from 'react';
import 'glyphline/style.css';
import 'glyphline/pdf.css';

export function PdfPage({
	page,
	scale,
	sentence,
	word
}: {
	page: PDFPageProxy; // from getDocument({ url, fontExtraProperties: true })
	scale: number;
	sentence: number;
	word: number;
}) {
	const host = useRef<HTMLDivElement>(null);
	const canvas = useRef<HTMLCanvasElement>(null);
	const layer = useRef<HTMLDivElement>(null);
	const base = useAsyncSource(() => pdfSource(page, { OPS }), [page]);
	const [source, setSource] = useState<PdfTextSource | null>(null);

	useEffect(() => {
		if (!base || !canvas.current || !layer.current || !host.current) return;
		const vp = page.getViewport({ scale });
		const c = canvas.current;
		const dpr = devicePixelRatio;
		c.width = vp.width * dpr;
		c.height = vp.height * dpr;
		const ctx = c.getContext('2d')!;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		host.current.style.setProperty('--scale-factor', String(scale));
		host.current.style.setProperty('--total-scale-factor', String(scale));
		const render = page.render({ canvas: c, canvasContext: ctx, viewport: vp });
		let tl: TextLayer | null = null;
		render.promise.then(
			async () => {
				layer.current!.replaceChildren();
				tl = new TextLayer({
					textContentSource: await page.getTextContent(),
					container: layer.current!,
					viewport: vp
				});
				await tl.render();
				setSource(base.withTextLayer(tl.textDivs, layer.current!, scale));
			},
			() => {}
		);
		return () => {
			render.cancel();
			tl?.cancel();
		};
	}, [page, base, scale]);

	const vp = page.getViewport({ scale });
	return (
		<div ref={host} style={{ position: 'relative', width: vp.width, height: vp.height }}>
			<canvas
				ref={canvas}
				style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
			/>
			<div ref={layer} className="textLayer" />
			<GlyphOverlay source={source ?? base} sentence={sentence} word={word} theme="light" />
		</div>
	);
}
