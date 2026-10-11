<!-- Copied from docs-site/content/docs/svelte/pdf.mdx; svelte-check keeps the docs example compiling. -->
<script lang="ts">
import { type PdfTextSource, pdfSource } from 'glyphline/pdf';
import { asyncText, GlyphOverlay } from 'glyphline/svelte';
import type { PDFPageProxy } from 'pdfjs-dist';
import 'glyphline/style.css';
import 'glyphline/pdf.css';

let {
	page,
	scale,
	sentence,
	word
}: {
	page: PDFPageProxy; // from getDocument({ url, fontExtraProperties: true })
	scale: number;
	sentence: number;
	word: number;
} = $props();

let host: HTMLDivElement;
let canvas: HTMLCanvasElement;
let layer: HTMLDivElement;
let layered = $state.raw<PdfTextSource | null>(null);

const base = asyncText(async () => {
	const { OPS } = await import('pdfjs-dist');
	return pdfSource(page, { OPS });
});
const vp = $derived(page.getViewport({ scale }));

$effect(() => {
	const src = base.source;
	if (!src) return;
	const { width, height } = vp;
	const dpr = devicePixelRatio;
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	const ctx = canvas.getContext('2d')!;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	host.style.setProperty('--scale-factor', String(scale));
	host.style.setProperty('--total-scale-factor', String(scale));
	const render = page.render({ canvas, canvasContext: ctx, viewport: vp });
	let tl: import('pdfjs-dist').TextLayer | null = null;
	render.promise.then(
		async () => {
			const { TextLayer } = await import('pdfjs-dist');
			layer.replaceChildren();
			tl = new TextLayer({
				textContentSource: await page.getTextContent(),
				container: layer,
				viewport: vp
			});
			await tl.render();
			layered = src.withTextLayer(tl.textDivs, layer, scale);
		},
		() => {}
	);
	return () => {
		render.cancel();
		tl?.cancel();
	};
});
</script>

<div bind:this={host} style="position: relative; width: {vp.width}px; height: {vp.height}px">
  <canvas bind:this={canvas} style="position: absolute; inset: 0; width: 100%; height: 100%"></canvas>
  <div bind:this={layer} class="textLayer"></div>
  <GlyphOverlay source={layered ?? base.source} {sentence} {word} theme="light" />
</div>
