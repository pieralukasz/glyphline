// Where each character of the page text sits, per method (M1 items, M2 text layer, M3 glyphs). Boxes are in page CSS px at scale 1
// (origin top-left, y down), so the overlay draws them at any zoom with one transform.

import type { Box } from '../core/types.ts';
import { quadBox } from './quad.ts';
import { type PageText, wordParts } from './text-model.ts';

type Point = [number, number];

export type MethodId = 'items' | 'range' | 'glyphs' | 'hybrid';

/** Per-character boxes for a page, indexed by page char index. `null` for characters without geometry. */
export type CharGeometry = (Box | null)[];

/** PDF user-space point -> page CSS px at scale 1 (the viewport applies CropBox and /Rotate). */
export type ToViewport = (x: number, y: number) => [number, number];

type MetricsOf = (fontName: string) => { ascent: number; descent: number };

/**
 * Quad of a glyph run (start-bottom, end-bottom, end-top, start-top). The item transform maps text
 * space at font size 1 to user space; x0..x1 run along the baseline in user-space units.
 */
function runQuad(
	transform: number[],
	x0: number,
	x1: number,
	ascent: number,
	descent: number,
	toViewport: ToViewport
): [Point, Point, Point, Point] {
	const [a, b, c, d, e, f] = transform;
	const fontHeight = Math.hypot(a, b);
	const ux = (tx: number, ty: number): Point =>
		toViewport((a * tx + c * ty) / fontHeight + e, (b * tx + d * ty) / fontHeight + f);
	return [
		ux(x0, descent * fontHeight),
		ux(x1, descent * fontHeight),
		ux(x1, ascent * fontHeight),
		ux(x0, ascent * fontHeight)
	];
}

/**
 * M1: split each item's width evenly over its characters. Exact at item edges (pdf.js measured
 * the item width with the real font), interpolated inside.
 */
export function geometryFromItems(
	page: PageText,
	toViewport: ToViewport,
	metricsOf: MetricsOf
): CharGeometry {
	const geom: CharGeometry = new Array(page.text.length).fill(null);
	page.items.forEach((item, i) => {
		const n = item.str.length;
		if (!n || !item.width) return;
		const { ascent, descent } = metricsOf(item.fontName);
		const start = page.itemStart[i];
		const cw = item.width / n;
		for (let o = 0; o < n; o++) {
			const ci = start + o;
			if (page.charItem[ci] !== i) continue; // dropped hyphen etc.
			geom[ci] = quadBox(
				runQuad(item.transform, o * cw, (o + 1) * cw, ascent, descent, toViewport)
			);
		}
	});
	return geom;
}

/**
 * M2: DOM Range boxes on the native pdf.js text layer (`textDivs[i]` is the span of item i),
 * divided by `scale` to get page px at scale 1.
 */
export function geometryFromTextLayer(
	page: PageText,
	textDivs: HTMLElement[],
	container: HTMLElement,
	scale: number
): CharGeometry {
	const geom: CharGeometry = new Array(page.text.length).fill(null);
	const origin = container.getBoundingClientRect();
	const range = document.createRange();
	page.items.forEach((item, i) => {
		const div = textDivs[i];
		const node = div?.firstChild;
		if (!node || node.nodeType !== Node.TEXT_NODE) return;
		const len = (node as Text).length;
		const start = page.itemStart[i];
		for (let o = 0; o < Math.min(len, item.str.length); o++) {
			const ci = start + o;
			if (page.charItem[ci] !== i) continue;
			range.setStart(node, o);
			range.setEnd(node, o + 1);
			const r = range.getBoundingClientRect();
			if (!r.width && !r.height) continue;
			geom[ci] = {
				x: (r.left - origin.left) / scale,
				y: (r.top - origin.top) / scale,
				w: r.width / scale,
				h: r.height / scale
			};
		}
	});
	return geom;
}

/** A glyph positioned by the operator-list walk (page px at scale 1, y down). */
export type Glyph = {
	unicode: string;
	x: number;
	y: number; // top
	w: number;
	h: number;
	fontName: string;
	/** where the glyph's baseline starts, page px at scale 1 (the pen position before the glyph) */
	origin?: [number, number];
};

const FORMAT_CHARS = /^[\u00ad\u200b-\u200f\u2060\ufeff]+$/;

/**
 * M3: glyphs and text items come from the same content stream in the same order, so each item
 * consumes glyphs, resyncing on the item origin when the streams disagree (invisible text, Type3).
 */
export function geometryFromGlyphs(
	page: PageText,
	glyphs: Glyph[],
	toViewport: ToViewport
): CharGeometry {
	const geom: CharGeometry = new Array(page.text.length).fill(null);
	const isWs = (s: string) => /^\s*$/.test(s);
	const norm = (s: string) => s.normalize('NFKC');
	let g = 0;
	page.items.forEach((item, i) => {
		const str = item.str;
		if (!str.trim()) return;
		const start = page.itemStart[i];
		const fontHeight = Math.hypot(item.transform[0], item.transform[1]);
		// item origin in viewport px; a glyph of this item must have a corner within 0.6 em of it
		const [ox, oy] = toViewport(item.transform[4], item.transform[5]);
		// compare pen positions when the walk reports them (a rotated glyph's box corners are far
		// from its origin); otherwise the nearest box corner
		const near = (gl: Glyph) =>
			(gl.origin
				? Math.hypot(gl.origin[0] - ox, gl.origin[1] - oy)
				: Math.min(
						Math.hypot(gl.x - ox, gl.y - oy),
						Math.hypot(gl.x + gl.w - ox, gl.y - oy),
						Math.hypot(gl.x - ox, gl.y + gl.h - oy),
						Math.hypot(gl.x + gl.w - ox, gl.y + gl.h - oy)
					)) <
			fontHeight * 0.6;
		// pdf.js reorders RTL items into logical order; the glyph stream stays visual (reversed)
		const rtl = item.dir === 'rtl';
		const order: number[] = [];
		for (let o = 0; o < str.length; o++) if (!isWs(str[o])) order.push(o);
		if (rtl) order.reverse();
		if (!order.length) return;
		const firstChar = str[order[0]];
		let probe = g;
		let found = -1;
		const limit = Math.min(glyphs.length, g + 400);
		for (; probe < limit; probe++) {
			const gl = glyphs[probe];
			if (isWs(gl.unicode)) continue;
			const u = norm(gl.unicode);
			if ((u[0] === firstChar || u === norm(firstChar)) && near(gl)) {
				found = probe;
				break;
			}
		}
		if (found < 0) return;
		g = found;
		for (let k = 0; k < order.length; k++) {
			const o = order[k];
			const ci = start + o;
			while (g < glyphs.length && isWs(glyphs[g].unicode)) g++;
			// glyphs that pdf.js drops from the text (soft hyphen, zero-width joiners) still sit in
			// the content stream: skip them when they do not match the next character
			while (
				g < glyphs.length &&
				FORMAT_CHARS.test(glyphs[g].unicode) &&
				norm(glyphs[g].unicode)[0] !== str[o]
			)
				g++;
			if (g >= glyphs.length) return;
			const gl = glyphs[g];
			const expanded = norm(gl.unicode);
			const covers = Math.max(1, expanded.length);
			if (covers > 1 && !rtl && str.startsWith(expanded, o)) {
				// ligature (ﬁ -> "fi"): split the advance evenly over the characters it covers
				const cw = gl.w / covers;
				for (let j = 0; j < covers; j++) {
					const cj = start + o + j;
					if (page.charItem[cj] === i) geom[cj] = { x: gl.x + j * cw, y: gl.y, w: cw, h: gl.h };
				}
				k += covers - 1;
			} else if (page.charItem[ci] === i) {
				geom[ci] = { x: gl.x, y: gl.y, w: gl.w, h: gl.h };
			}
			g++;
		}
	});
	return geom;
}

/**
 * Boxes of one word part per entry of `wordParts(page)`: the union of the part's character boxes
 * (a part never crosses a visual line). `null` when the method has no geometry for any character.
 */
export function partBoxes(
	page: PageText,
	geom: CharGeometry,
	parts = wordParts(page)
): (Box | null)[] {
	return parts.map((p) => {
		let x1 = Number.POSITIVE_INFINITY;
		let y1 = Number.POSITIVE_INFINITY;
		let x2 = Number.NEGATIVE_INFINITY;
		let y2 = Number.NEGATIVE_INFINITY;
		for (let i = p.start; i < p.end; i++) {
			const b = geom[i];
			if (!b) continue;
			x1 = Math.min(x1, b.x);
			y1 = Math.min(y1, b.y);
			x2 = Math.max(x2, b.x + b.w);
			y2 = Math.max(y2, b.y + b.h);
		}
		return x1 === Number.POSITIVE_INFINITY ? null : { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
	});
}

/** Every box of every word, indexed by word: a word broken across lines has one box per line. */
export function wordBoxes(page: PageText, geom: CharGeometry): Box[][] {
	const parts = wordParts(page);
	const boxes = partBoxes(page, geom, parts);
	const out: Box[][] = page.words.map(() => []);
	parts.forEach((p, i) => {
		const b = boxes[i];
		if (b) out[p.word].push(b);
	});
	return out;
}

/** Where a text item's boxes came from in a hybrid geometry. */
export type Provenance = MethodId | null;

export type HybridGeometry = {
	geom: CharGeometry;
	/** per text item: the method that supplied its boxes, null when none could */
	source: Provenance[];
	/** items that needed a fallback (the primary method had no box for some printed character) */
	fallbackItems: number;
};

/**
 * When the primary misses any printed character of an item, the whole item takes the first fallback
 * that covers it, so a word is never drawn half from one method and half from another.
 */
export function withFallback(
	page: PageText,
	primary: { id: MethodId; geom: CharGeometry },
	fallbacks: { id: MethodId; geom: CharGeometry | null }[]
): HybridGeometry {
	const geom: CharGeometry = new Array(page.text.length).fill(null);
	const source: Provenance[] = new Array(page.items.length).fill(null);
	let fallbackItems = 0;
	const covers = (g: CharGeometry, i: number) => {
		const start = page.itemStart[i];
		const str = page.items[i].str;
		for (let o = 0; o < str.length; o++) {
			const ci = start + o;
			if (page.charItem[ci] !== i || /\s/.test(str[o])) continue;
			if (!g[ci]) return false;
		}
		return true;
	};
	page.items.forEach((item, i) => {
		if (!item.str.trim()) return;
		const pick = [primary, ...fallbacks].find((m) => m.geom && covers(m.geom, i));
		if (!pick?.geom) return;
		if (pick.id !== primary.id) fallbackItems++;
		source[i] = pick.id;
		const start = page.itemStart[i];
		for (let o = 0; o < item.str.length; o++) {
			const ci = start + o;
			if (page.charItem[ci] === i) geom[ci] = pick.geom[ci];
		}
	});
	return { geom, source, fallbackItems };
}

/**
 * Anchor of every word part for pairing with ground truth, interpolated along its text item. Text
 * content only, so the pairing is the same whichever method is judged.
 */
export function partAnchors(
	page: PageText,
	toViewport: ToViewport,
	parts = wordParts(page)
): ([number, number] | null)[] {
	return parts.map((p) => {
		const i = page.charItem[p.start];
		if (i < 0) return null;
		const item = page.items[i];
		const [a, b, c, d, e, f] = item.transform;
		const fh = Math.hypot(a, b) || 1;
		const n = item.str.length || 1;
		const o0 = page.charOffset[p.start];
		const lastItem = page.charItem[p.end - 1];
		const o1 = lastItem === i ? page.charOffset[p.end - 1] + 1 : n;
		const t = ((o0 + o1) / 2 / n) * item.width;
		// lifted by ~0.3 em to the middle of the x-height
		const ty = 0.3 * fh;
		return toViewport((a * t + c * ty) / fh + e, (b * t + d * ty) / fh + f);
	});
}
