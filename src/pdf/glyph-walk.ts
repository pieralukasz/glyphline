// M3: position every glyph with the embedded font's advances, walking the operator list with the
// same state machine as pdf.js CanvasGraphics (save/restore, setGState, setFont, showText).

import type { Glyph } from './geometry.ts';
import { quadBox } from './quad.ts';

type Matrix = [number, number, number, number, number, number];

export type OperatorList = { fnArray: number[]; argsArray: unknown[][] };

export type FontMetrics = {
	ascent: number;
	descent: number;
	fontMatrix?: number[] | null;
	/** vertical writing mode (CMap ending in -V): glyphs advance downwards using `vmetric` */
	vertical?: boolean;
};

export type GlyphWalkInput = {
	ops: OperatorList;
	OPS: Record<string, number>;
	/** font loadedName -> metrics (from page.commonObjs with fontExtraProperties: true) */
	fontOf: (loadedName: string) => FontMetrics | undefined;
	/** PDF user space point -> page CSS px at scale 1 (viewport.convertToViewportPoint) */
	toViewport: (x: number, y: number) => [number, number];
};

type PdfGlyph = {
	unicode: string;
	width: number;
	isSpace: boolean;
	fontChar?: string;
	/** vertical fonts: [w1y, vx, vy] in glyph space */
	vmetric?: number[];
};

const mul = (m1: Matrix, m2: Matrix): Matrix => [
	m1[0] * m2[0] + m1[1] * m2[2],
	m1[0] * m2[1] + m1[1] * m2[3],
	m1[2] * m2[0] + m1[3] * m2[2],
	m1[2] * m2[1] + m1[3] * m2[3],
	m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
	m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
];
const apply = (m: Matrix, x: number, y: number): [number, number] => [
	m[0] * x + m[2] * y + m[4],
	m[1] * x + m[3] * y + m[5]
];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const DEFAULT_METRICS: FontMetrics = { ascent: 0.8, descent: -0.2 };

/** What `q` and form XObjects push and pop, text state included (pdf.js CanvasExtraState). */
type State = {
	ctm: Matrix;
	textMatrix: Matrix | null;
	lineX: number;
	lineY: number;
	x: number;
	y: number;
	fontName: string;
	fontSize: number;
	/** -1 for a negative size in Tf: pdf.js mirrors the glyphs in both axes */
	fontDirection: 1 | -1;
	fontMatrix0: number;
	metrics: FontMetrics;
	charSpacing: number;
	wordSpacing: number;
	hScale: number;
	leading: number;
	rise: number;
};

const initialState = (): State => ({
	ctm: IDENTITY,
	textMatrix: null,
	lineX: 0,
	lineY: 0,
	x: 0,
	y: 0,
	fontName: '',
	fontSize: 0,
	fontDirection: 1,
	fontMatrix0: 0.001,
	metrics: DEFAULT_METRICS,
	charSpacing: 0,
	wordSpacing: 0,
	hScale: 1,
	leading: 0,
	rise: 0
});

/** Axis-aligned box of a text-space rectangle: all four corners go through the matrix. */
function aabb(
	m: Matrix,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	toViewport: GlyphWalkInput['toViewport']
) {
	return quadBox(
		[apply(m, x0, y0), apply(m, x1, y0), apply(m, x0, y1), apply(m, x1, y1)].map(([x, y]) =>
			toViewport(x, y)
		)
	);
}

export function walkGlyphs({ ops, OPS, fontOf, toViewport }: GlyphWalkInput): Glyph[] {
	const out: Glyph[] = [];
	let s = initialState();
	const stack: State[] = [];

	const setFont = (name: unknown, size: unknown) => {
		s.fontName = String(name);
		const n = Number(size);
		s.fontDirection = n < 0 ? -1 : 1;
		s.fontSize = Math.abs(n);
		const m = fontOf(s.fontName);
		s.metrics = m ?? DEFAULT_METRICS;
		s.fontMatrix0 = m?.fontMatrix?.[0] ?? 0.001;
	};

	const { fnArray, argsArray } = ops;
	for (let i = 0; i < fnArray.length; i++) {
		const fn = fnArray[i];
		const args = argsArray[i] as unknown[];
		switch (fn) {
			case OPS.save:
				stack.push(s);
				s = { ...s };
				break;
			case OPS.restore:
				// pdf.js ignores an unbalanced Q
				s = stack.pop() ?? s;
				break;
			case OPS.transform:
				s.ctm = mul(args as unknown as Matrix, s.ctm);
				break;
			case OPS.paintFormXObjectBegin: {
				stack.push(s);
				s = { ...s };
				const m = args[0] as Matrix | null;
				if (m) s.ctm = mul(Array.from(m) as Matrix, s.ctm);
				break;
			}
			case OPS.paintFormXObjectEnd:
				s = stack.pop() ?? s;
				break;
			case OPS.beginText:
				s.textMatrix = null;
				s.x = s.lineX = 0;
				s.y = s.lineY = 0;
				break;
			case OPS.setFont:
				setFont(args[0], args[1]);
				break;
			case OPS.setGState:
				// an ExtGState can carry the font: /Font [ref size] (pdf.js: setGState -> setFont)
				for (const [key, value] of (args[0] ?? []) as [string, unknown][]) {
					if (key === 'Font') {
						const [name, size] = value as [unknown, unknown];
						setFont(name, size);
					}
				}
				break;
			case OPS.setCharSpacing:
				s.charSpacing = Number(args[0]);
				break;
			case OPS.setWordSpacing:
				s.wordSpacing = Number(args[0]);
				break;
			case OPS.setHScale:
				s.hScale = Number(args[0]) / 100;
				break;
			case OPS.setLeading:
				s.leading = -Number(args[0]);
				break;
			case OPS.setTextRise:
				s.rise = Number(args[0]);
				break;
			case OPS.moveText:
				s.x = s.lineX += Number(args[0]);
				s.y = s.lineY += Number(args[1]);
				break;
			case OPS.setLeadingMoveText:
				// TD: pdf.js calls setLeading(-y), i.e. leading = y
				s.leading = Number(args[1]);
				s.x = s.lineX += Number(args[0]);
				s.y = s.lineY += Number(args[1]);
				break;
			case OPS.setTextMatrix:
				s.textMatrix = Array.from(args[0] as ArrayLike<number>) as Matrix;
				s.x = s.lineX = 0;
				s.y = s.lineY = 0;
				break;
			case OPS.nextLine:
				s.x = s.lineX;
				s.y = s.lineY += s.leading;
				break;
			case OPS.showText:
				showText(args[0] as (PdfGlyph | number)[]);
				break;
			default:
				break;
		}
	}
	return out;

	function showText(glyphs: (PdfGlyph | number)[]) {
		const { fontSize, fontDirection, hScale, charSpacing, wordSpacing, metrics } = s;
		if (!fontSize) return;
		const vertical = !!metrics.vertical;
		// text space -> user space for this run; a negative Tf mirrors x and y (pdf.js scales the
		// canvas by (hScale * dir, dir) relative to the usual flip)
		let m: Matrix = s.textMatrix ?? IDENTITY;
		m = mul([1, 0, 0, 1, s.x, s.y + s.rise], m);
		m = mul([hScale * fontDirection, 0, 0, fontDirection, 0, 0], m);
		const full = mul(m, s.ctm);
		const widthAdvanceScale = fontSize * s.fontMatrix0;
		const ascent = (metrics.ascent || 0.8) * fontSize;
		const descent = (metrics.descent || -0.2) * fontSize;
		const spacingDir = vertical ? 1 : -1;
		let gx = 0;
		for (const g of glyphs) {
			if (typeof g === 'number') {
				gx += (spacingDir * g * fontSize) / 1000;
				continue;
			}
			const spacing = (g.isSpace ? wordSpacing : 0) + charSpacing;
			let box: ReturnType<typeof aabb>;
			let adv: number;
			let origin: [number, number];
			if (vertical && g.vmetric) {
				// pdf.js: the glyph is drawn at (vx, x + vy) in a y-down space, i.e. its baseline sits
				// at y = -(x + vy) in text space; the pen moves down by w1y
				const vx = -g.vmetric[1] * widthAdvanceScale;
				const vy = g.vmetric[2] * widthAdvanceScale;
				const base = -(gx + vy);
				box = aabb(
					full,
					vx,
					base + descent,
					vx + g.width * widthAdvanceScale,
					base + ascent,
					toViewport
				);
				adv = -g.vmetric[0] * widthAdvanceScale - spacing * fontDirection;
				origin = toViewport(...apply(full, vx, base));
			} else {
				const w = g.width * widthAdvanceScale;
				box = aabb(full, gx, descent, gx + w, ascent, toViewport);
				adv = w + spacing * fontDirection;
				origin = toViewport(...apply(full, gx, 0));
			}
			out.push({ unicode: g.unicode, ...box, fontName: s.fontName, origin });
			gx += adv;
		}
		if (vertical) s.y -= gx;
		else s.x += gx * hScale * fontDirection;
	}
}
