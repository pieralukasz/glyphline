// Ground-truth benchmark: a method's word-part boxes against the true boxes shipped with the PDF
// (normalised 0-1, top-left origin). Fail-closed, so an empty or partial result never looks good:
// one method-independent pairing per page, a pair without a box is a miss (IoU 0, counted in
// coverage), no boxed pair gives `status: 'no-data'` with null statistics, edge error = max(dx, dy).

import type { Box } from '../src/core/types.ts';

export type GroundTruthWord = {
	t: string; // text
	b: [number, number, number, number]; // bbox_view: x0 y0 x1 y1 normalised
	c: string; // case id
	v: boolean; // visible
	e: boolean; // extractable
	i: number; // in_page fraction
};

export type GroundTruth = {
	cases: { id: string; page: number; title: string; why: string }[];
	pages: { page: number; title: string; words: GroundTruthWord[] }[];
};

export type WordError = {
	text: string;
	caseId: string;
	/** max of left/right edge error in page px */
	dx: number;
	/** max of top/bottom edge error in page px */
	dy: number;
	/** max(dx, dy) */
	edge: number;
	iou: number;
};

const norm = (s: string) =>
	s
		.normalize('NFKC')
		.replace(/[\u00a0\u202f\u2009\uf0a0]/g, ' ')
		.replace(/[\u00ad\u200b\u200c\u200d]/g, '')
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, '');

/** Only words a reader is expected to find: visible, extractable, mostly inside the page. */
export const expectedWords = (words: GroundTruthWord[]) =>
	words.filter((w) => w.v && w.e && w.i > 0.5);

/** A text-model word part with an anchor in page px from the text content, not from any method. */
export type AlignUnit = {
	text: string;
	anchor: [number, number] | null;
};

/**
 * Pair ground-truth words with units by normalised text: an LCS in reading order, then leftovers
 * (interleaved columns, bottom-up text, RTL) by same text, repeats told apart by the unit's anchor.
 */
export function alignWords(
	truth: GroundTruthWord[],
	units: AlignUnit[],
	pageSize: { width: number; height: number }
): { truth: number; unit: number }[] {
	const a = truth.map((w) => norm(w.t));
	const b = units.map((w) => norm(w.text));
	// RTL ground truth stores logical order; pdf.js gives visual order, so the letters are reversed
	const rev = (s: string) => [...s].reverse().join('');
	const n = a.length;
	const m = b.length;
	const dp = new Uint16Array((n + 1) * (m + 1));
	const idx = (i: number, j: number) => i * (m + 1) + j;
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[idx(i, j)] =
				a[i] && a[i] === b[j]
					? dp[idx(i + 1, j + 1)] + 1
					: Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
		}
	}
	const pairs: { truth: number; unit: number }[] = [];
	const usedTruth = new Set<number>();
	const usedUnit = new Set<number>();
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] && a[i] === b[j]) {
			pairs.push({ truth: i, unit: j });
			usedTruth.add(i);
			usedUnit.add(j);
			i++;
			j++;
		} else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) i++;
		else j++;
	}
	const byText = new Map<string, number[]>();
	for (let k = 0; k < m; k++) {
		if (usedUnit.has(k) || !b[k]) continue;
		const list = byText.get(b[k]) ?? [];
		list.push(k);
		byText.set(b[k], list);
	}
	const { width: W, height: H } = pageSize;
	for (let t = 0; t < n; t++) {
		if (usedTruth.has(t) || !a[t]) continue;
		const candidates = byText.get(a[t]) ?? byText.get(rev(a[t])) ?? [];
		const [tx0, ty0, tx1, ty1] = truth[t].b;
		const cx = ((tx0 + tx1) / 2) * W;
		const cy = ((ty0 + ty1) / 2) * H;
		let best = -1;
		let bestD = Number.POSITIVE_INFINITY;
		for (const k of candidates) {
			if (usedUnit.has(k)) continue;
			const p = units[k].anchor;
			const d = p ? Math.hypot(p[0] - cx, p[1] - cy) : Number.MAX_SAFE_INTEGER / 2;
			if (d < bestD) {
				bestD = d;
				best = k;
			}
		}
		if (best >= 0) {
			pairs.push({ truth: t, unit: best });
			usedTruth.add(t);
			usedUnit.add(best);
		}
	}
	return pairs;
}

export function wordError(
	truth: GroundTruthWord,
	box: Box,
	pageWidth: number,
	pageHeight: number
): WordError {
	const tx0 = truth.b[0] * pageWidth;
	const ty0 = truth.b[1] * pageHeight;
	const tx1 = truth.b[2] * pageWidth;
	const ty1 = truth.b[3] * pageHeight;
	const bx1 = box.x + box.w;
	const by1 = box.y + box.h;
	const ix = Math.max(0, Math.min(tx1, bx1) - Math.max(tx0, box.x));
	const iy = Math.max(0, Math.min(ty1, by1) - Math.max(ty0, box.y));
	const inter = ix * iy;
	const union = (tx1 - tx0) * (ty1 - ty0) + box.w * box.h - inter;
	const dx = Math.max(Math.abs(box.x - tx0), Math.abs(bx1 - tx1));
	const dy = Math.max(Math.abs(box.y - ty0), Math.abs(by1 - ty1));
	return {
		text: truth.t,
		caseId: truth.c,
		dx,
		dy,
		edge: Math.max(dx, dy),
		iou: union > 0 ? inter / union : 0
	};
}

/** Statistics of a set of expected words. Null statistics mean "no data", never "no error". */
export type BenchStats = {
	status: 'ok' | 'no-data';
	truthWords: number;
	/** paired with a text-model unit */
	matched: number;
	/** paired and given a box by the method */
	withBox: number;
	/** withBox / truthWords */
	coverage: number;
	medianEdge: number | null;
	p90Edge: number | null;
	maxEdge: number | null;
	medianDx: number | null;
	medianDy: number | null;
	maxDy: number | null;
	/** boxed words with edge > 4 px */
	over4px: number;
	/** over4px plus misses and unmatched words */
	notWithin4px: number;
	/** over all expected words, a miss counts as 0 */
	meanIou: number;
};

export type BenchSummary = BenchStats & { byCase: Record<string, BenchStats> };

const quantile = (xs: number[], q: number): number | null => {
	if (!xs.length) return null;
	const s = [...xs].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};

function stats(truthWords: number, matched: number, errors: WordError[]): BenchStats {
	const edge = errors.map((e) => e.edge);
	const dy = errors.map((e) => e.dy);
	const over4px = edge.filter((d) => d > 4).length;
	return {
		status: errors.length ? 'ok' : 'no-data',
		truthWords,
		matched,
		withBox: errors.length,
		coverage: truthWords ? errors.length / truthWords : 0,
		medianEdge: quantile(edge, 0.5),
		p90Edge: quantile(edge, 0.9),
		maxEdge: edge.length ? Math.max(...edge) : null,
		medianDx: quantile(
			errors.map((e) => e.dx),
			0.5
		),
		medianDy: quantile(dy, 0.5),
		maxDy: dy.length ? Math.max(...dy) : null,
		over4px,
		notWithin4px: truthWords - (errors.length - over4px),
		meanIou: truthWords ? errors.reduce((a, e) => a + e.iou, 0) / truthWords : 0
	};
}

/** `matched`: expected words paired with a unit; `errors`: one per paired word with a box. */
export function summarizeBench(
	truth: GroundTruthWord[],
	matched: GroundTruthWord[],
	errors: WordError[]
): BenchSummary {
	const byCase: Record<string, BenchStats> = {};
	const ids = [...new Set(truth.map((w) => w.c))];
	for (const id of ids) {
		byCase[id] = stats(
			truth.filter((w) => w.c === id).length,
			matched.filter((w) => w.c === id).length,
			errors.filter((e) => e.caseId === id)
		);
	}
	return { ...stats(truth.length, matched.length, errors), byCase };
}

/** Benchmark several geometries on one page with one shared pairing. */
export function benchPage<K extends string>(
	truth: GroundTruthWord[],
	units: AlignUnit[],
	boxesByMethod: Record<K, (Box | null)[]>,
	pageSize: { width: number; height: number }
): { pairs: { truth: number; unit: number }[]; results: Record<K, BenchSummary> } {
	const pairs = alignWords(truth, units, pageSize);
	const matched = pairs.map((p) => truth[p.truth]);
	const results = {} as Record<K, BenchSummary>;
	for (const key of Object.keys(boxesByMethod) as K[]) {
		const boxes = boxesByMethod[key];
		const errors: WordError[] = [];
		for (const p of pairs) {
			const box = boxes[p.unit];
			if (box) errors.push(wordError(truth[p.truth], box, pageSize.width, pageSize.height));
		}
		results[key] = summarizeBench(truth, matched, errors);
	}
	return { pairs, results };
}
