// Ground-truth benchmark in Node: M1, raw M3 and M3+ (falling back to M1 here). M2 needs a DOM. Every case is asserted on its own so a page cannot hide it.

import { beforeAll, describe, expect, it } from 'vitest';
import type { BenchStats, GroundTruth } from './bench.ts';
import { benchStressPage, loadStress, type PageBench } from './bench-harness.ts';

const results = new Map<number, PageBench>();
let truth: GroundTruth;

beforeAll(async () => {
	const loaded = await loadStress();
	truth = loaded.truth;
	for (const p of truth.pages)
		results.set(p.page, await benchStressPage(loaded.doc, truth, p.page));
}, 60_000);

const page = (n: number) => {
	const r = results.get(n);
	if (!r) throw new Error(`page ${n} was not measured`);
	return r;
};

// M3+ budgets measured 2026-10-11. The top edge sits ~17% of the box height high (pdf.js font ascent
// vs reportlab AFM ascent), hence ~2 px edge budgets; dx has no such offset and must stay exact.
// Page 1 coverage is 80%: Intl.Segmenter splits tokens like "ground-truth" and "p.2".
const groups: { page: number; title: string; p90Edge: number; notWithin4: number; cov: number }[] =
	[
		{ page: 1, title: 'index page', p90Edge: 1.5, notWithin4: 100, cov: 0.8 },
		{ page: 2, title: 'A glyph widths', p90Edge: 3, notWithin4: 14, cov: 0.95 },
		{ page: 3, title: 'B spacing operators', p90Edge: 2.5, notWithin4: 15, cov: 0.95 },
		{ page: 4, title: 'C mixed fonts and baselines', p90Edge: 3.5, notWithin4: 23, cov: 0.9 },
		{ page: 5, title: 'D unicode traps', p90Edge: 4.5, notWithin4: 36, cov: 0.88 },
		{ page: 6, title: 'E scripts and direction', p90Edge: 5, notWithin4: 57, cov: 0.93 },
		{ page: 7, title: 'F rotation and matrices', p90Edge: 3.5, notWithin4: 9, cov: 0.98 },
		{ page: 8, title: 'G layout and visibility', p90Edge: 2.5, notWithin4: 10, cov: 0.99 },
		{ page: 9, title: 'H OCR layers', p90Edge: 5, notWithin4: 17, cov: 0.97 },
		{ page: 10, title: 'P1 /Rotate 90', p90Edge: 3, notWithin4: 3, cov: 1 },
		{ page: 11, title: 'P2 CropBox', p90Edge: 2.5, notWithin4: 2, cov: 1 },
		{ page: 12, title: 'P3 A6', p90Edge: 1.5, notWithin4: 2, cov: 1 },
		{ page: 13, title: 'P4 landscape', p90Edge: 2.5, notWithin4: 2, cov: 1 },
		{ page: 14, title: 'M1 composite article', p90Edge: 3, notWithin4: 50, cov: 0.96 },
		{ page: 15, title: 'M2 composite article', p90Edge: 3, notWithin4: 48, cov: 0.96 },
		{
			page: 16,
			title: 'N textbook: openers, drop caps, wrap',
			p90Edge: 3,
			notWithin4: 16,
			cov: 0.96
		},
		{
			page: 17,
			title: 'N textbook: sidebars, lists, footnotes',
			p90Edge: 3,
			notWithin4: 16,
			cov: 0.96
		},
		{
			page: 18,
			title: 'N textbook: pull quote, initials, diagram',
			p90Edge: 3,
			notWithin4: 8,
			cov: 0.97
		},
		{ page: 19, title: 'N textbook: images over text', p90Edge: 3, notWithin4: 3, cov: 0.99 }
	];

describe('benchmark is fail-closed', () => {
	it('covers every page of the ground truth', () => {
		expect([...results.keys()].sort((a, b) => a - b)).toEqual(truth.pages.map((p) => p.page));
	});
});

describe('glyph advances with fallback (M3+) against ground truth, per page', () => {
	for (const g of groups) {
		it(`${g.title}: coverage ≥ ${g.cov * 100}%, median dx ≤ 0.5 px, p90 edge ≤ ${g.p90Edge} px, ≤ ${g.notWithin4} words not within 4 px`, () => {
			const r = page(g.page).results.hybrid;
			expect(r.status).toBe('ok');
			expect(r.coverage).toBeGreaterThanOrEqual(g.cov);
			expect(r.medianDx).not.toBeNull();
			expect(r.medianDx as number).toBeLessThanOrEqual(0.5);
			expect(r.p90Edge as number).toBeLessThanOrEqual(g.p90Edge);
			expect(r.notWithin4px).toBeLessThanOrEqual(g.notWithin4);
		});
	}
});

// Cases below the floor, asserted at their measured level (2026-10-11, rounded down) so a
// regression still fails.
const KNOWN_GAPS: Record<string, { coverage: number; iou: number; why: string }> = {
	B1: {
		coverage: 0,
		iou: 0,
		why: 'no text-model word matches LETTERSPACED/HEADING (not investigated)'
	},
	C2: {
		coverage: 0.81,
		iou: 0.56,
		why: 'word segmentation of inline math differs from the ground truth ("xi2" -> "xi", "2")'
	},
	D3: {
		coverage: 0.6,
		iou: 0.49,
		why: 'ground truth keeps "42 ± 3" as one word, the text model has "42", "3"'
	},
	D6: {
		coverage: 0.63,
		iou: 0.45,
		why: 'URLs, e-mails, numbers with separators: different word split (not investigated)'
	},
	E4: { coverage: 0.81, iou: 0.56, why: 'CJK word segmentation differs: "には" -> "に", "は"' },
	E5: {
		coverage: 0.25,
		iou: 0.17,
		why: 'stacked vertical CJK: 1 of 4 words matched (not investigated)'
	},
	H3: {
		coverage: 1,
		iou: 0.52,
		why: 'skewed scan: the true box follows the tilted ink, the OCR layer is level'
	},
	N12: {
		coverage: 0.66,
		iou: 0.56,
		why: 'pull quote: the oversized opening quote is its own ground-truth word (not investigated)'
	}
};
const FLOOR = { coverage: 0.75, iou: 0.6 };

describe('every case on its own (M3+)', () => {
	it('each case id of the ground truth is measured', () => {
		const ids = new Set(truth.cases.map((c) => c.id));
		const measured = new Set<string>();
		for (const r of results.values())
			for (const id of Object.keys(r.results.hybrid.byCase)) measured.add(id);
		// H4 (outlines without any text) has no extractable word by design
		const missing = [...ids].filter((id) => !measured.has(id) && id !== 'H4');
		expect(missing).toEqual([]);
	});

	it('meets the floor, or the measured level of a listed gap', () => {
		const failures: string[] = [];
		for (const [n, r] of results) {
			for (const [id, s] of Object.entries(r.results.hybrid.byCase) as [string, BenchStats][]) {
				if (id === 'caption' || id === 'heading' || id === 'index') continue;
				const floor = KNOWN_GAPS[id] ?? FLOOR;
				if (s.coverage < floor.coverage - 1e-9 || s.meanIou < floor.iou - 1e-9) {
					failures.push(
						`p${n} ${id}: coverage ${s.coverage.toFixed(2)} (≥ ${floor.coverage}), IoU ${s.meanIou.toFixed(2)} (≥ ${floor.iou})`
					);
				}
			}
		}
		expect(failures).toEqual([]);
	});
});

describe('method ranking on every page (same pairs, misses count as IoU 0)', () => {
	for (const g of groups) {
		it(`${g.title}: M3+ beats M1`, () => {
			const { hybrid, items } = page(g.page).results;
			expect(hybrid.meanIou).toBeGreaterThan(items.meanIou);
		});
	}

	it('the fallback never loses coverage against raw M3', () => {
		for (const g of groups) {
			const { hybrid, glyphs } = page(g.page).results;
			expect(hybrid.withBox).toBeGreaterThanOrEqual(glyphs.withBox);
		}
	});
});
