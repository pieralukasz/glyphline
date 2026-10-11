// The walk runs on real minimal PDFs parsed by pdf.js, so it is checked against what pdf.js extracts.

import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { walkGlyphs } from '../src/pdf/glyph-walk.ts';

/** One-page PDF with Helvetica as /F1 and an ExtGState /GS1 that sets the font at 10 pt. */
function makePdf(content: string): Uint8Array {
	const objects = [
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> /ExtGState << /GS1 << /Font [4 0 R 10] >> >> >> /Contents 5 0 R >>',
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`
	];
	let out = '%PDF-1.7\n';
	const offsets: number[] = [];
	objects.forEach((o, i) => {
		offsets.push(out.length);
		out += `${i + 1} 0 obj\n${o}\nendobj\n`;
	});
	const xref = out.length;
	out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
		.map((x) => `${String(x).padStart(10, '0')} 00000 n `)
		.join(
			'\n'
		)}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
	return new TextEncoder().encode(out);
}

async function walk(content: string) {
	const task = getDocument({ data: makePdf(content), fontExtraProperties: true, verbosity: 0 });
	const doc = await task.promise;
	const page = await doc.getPage(1);
	const [text, ops] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
	const glyphs = walkGlyphs({
		ops,
		OPS: OPS as unknown as Record<string, number>,
		fontOf: (n) => {
			const f = page.commonObjs.has(n) ? page.commonObjs.get(n) : null;
			return f ? { ascent: f.ascent, descent: f.descent, fontMatrix: f.fontMatrix } : undefined;
		},
		// PDF user space, no flip: easier to reason about in assertions
		toViewport: (x, y) => [x, y]
	});
	const items = text.items.filter((i) => 'str' in i) as { str: string; width: number }[];
	await task.destroy();
	return { glyphs, items };
}

describe('glyph walk restores the whole text state, like pdf.js', () => {
	it('q/Q restores the font size (Tf 10, q, Tf 20, Q)', async () => {
		const { glyphs, items } = await walk(
			'BT /F1 10 Tf ET q BT /F1 20 Tf ET Q BT 1 0 0 1 20 100 Tm (A) Tj ET'
		);
		expect(items[0].width).toBeCloseTo(6.67, 2); // what pdf.js measured
		expect(glyphs).toHaveLength(1);
		expect(glyphs[0].w).toBeCloseTo(items[0].width, 2);
	});

	it('q/Q restores char spacing and the text rise', async () => {
		const { glyphs } = await walk(
			'BT /F1 10 Tf ET q BT 5 Tc 3 Ts ET Q BT /F1 10 Tf 1 0 0 1 20 100 Tm (AB) Tj ET'
		);
		expect(glyphs[1].x - glyphs[0].x).toBeCloseTo(6.67, 2); // no Tc after Q
		expect(glyphs[0].origin?.[1]).toBeCloseTo(100, 5); // no rise after Q
	});

	it('takes the font from an ExtGState (/GS1 gs with /Font [ref 10])', async () => {
		const { glyphs, items } = await walk('BT /GS1 gs 1 0 0 1 20 100 Tm (A) Tj ET');
		expect(items.map((i) => i.str)).toEqual(['A']);
		expect(glyphs).toHaveLength(1);
		expect(glyphs[0].w).toBeCloseTo(items[0].width, 2);
	});

	it('a rotated glyph gets the bounding box of all four corners', async () => {
		// 45° text matrix at 10 pt: Helvetica "A" advance 6.67, ascent+descent ~ 9.25 (pdf.js metrics)
		const c = Math.SQRT1_2;
		const { glyphs } = await walk(`BT /F1 10 Tf ${c} ${c} ${-c} ${c} 50 50 Tm (A) Tj ET`);
		const g = glyphs[0];
		expect(g.w).toBeCloseTo(g.h, 5); // square AABB for a 45° box of any proportions
		// the two-corner bug gave |adv - height| * cos45 ≈ 1.8; four corners give (adv + height) * cos45
		expect(g.w).toBeGreaterThan(10);
	});

	it('a negative font size mirrors the run (pdf.js fontDirection -1)', async () => {
		const { glyphs } = await walk('BT /F1 -10 Tf 1 0 0 1 100 100 Tm (AB) Tj ET');
		expect(glyphs).toHaveLength(2);
		// the pen moves left: B sits left of A, each 6.67 wide
		expect(glyphs[1].x).toBeLessThan(glyphs[0].x);
		expect(glyphs[0].w).toBeCloseTo(6.67, 2);
	});
});
