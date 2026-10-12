// Sentence outline: merge the line boxes of a range into one rounded path, the way a reader
// draws a multi-line highlight as a single shape instead of one rectangle per line.

import type { Box } from './types.ts';

/** Axis of a set of word boxes: vertical when most of their extent is taller than wide. */
function isVertical(boxes: Box[]) {
	let wide = 0;
	let tall = 0;
	for (const b of boxes) {
		if (b.w >= b.h) wide += b.w;
		else tall += b.h;
	}
	return tall > wide;
}

const flip = (b: Box): Box => ({ x: b.y, y: b.x, w: b.h, h: b.w });

/**
 * Merge word boxes that sit on one visual line into a single line box. Boxes overlap across the
 * line (allowing for sub/superscripts and symbols from a smaller font) and are at most ~1.5 em
 * apart along it (a column gap is wider than that and starts a new line box). Vertical text
 * (rotated lines, stacked CJK) is handled by swapping the axes.
 */
export function mergeLines(boxes: Box[]): Box[] {
	if (isVertical(boxes)) return mergeHorizontal(boxes.map(flip)).map(flip);
	return mergeHorizontal(boxes);
}

function mergeHorizontal(boxes: Box[]): Box[] {
	const joins = (l: Box, b: Box) => {
		const overlap = Math.min(l.y + l.h, b.y + b.h) - Math.max(l.y, b.y);
		const gap = Math.max(l.x - (b.x + b.w), b.x - (l.x + l.w));
		return overlap > Math.min(l.h, b.h) * 0.4 && gap < Math.max(l.h, b.h) * 1.5;
	};
	const union = (a: Box, b: Box): Box => {
		const x1 = Math.min(a.x, b.x);
		const y1 = Math.min(a.y, b.y);
		return {
			x: x1,
			y: y1,
			w: Math.max(a.x + a.w, b.x + b.w) - x1,
			h: Math.max(a.y + a.h, b.y + b.h) - y1
		};
	};
	const sorted = [...boxes].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2) || a.x - b.x);
	let lines: Box[] = [];
	for (const b of sorted) {
		// a box can bridge two line boxes that were apart until now: merge every line it joins
		let merged: Box = { ...b };
		const rest: Box[] = [];
		for (const l of lines) {
			if (joins(l, merged)) merged = union(l, merged);
			else rest.push(l);
		}
		let changed = true;
		while (changed) {
			changed = false;
			for (let i = rest.length - 1; i >= 0; i--) {
				if (joins(rest[i], merged)) {
					merged = union(rest[i], merged);
					rest.splice(i, 1);
					changed = true;
				}
			}
		}
		lines = [...rest, merged];
	}
	return lines.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Group line boxes into runs (consecutive lines of one column); vertical text: one run per line. */
export function groupRuns(boxes: Box[]): Box[][] {
	const lines = mergeLines(boxes);
	if (isVertical(boxes)) return lines.map((l) => [l]);
	const runs: Box[][] = [];
	for (const b of lines) {
		// continue the run whose last line sits just above and overlaps horizontally (same column)
		const run = runs.find((r) => {
			const last = r[r.length - 1];
			const below = b.y - (last.y + last.h) < last.h * 0.9 && b.y > last.y;
			const sameColumn = b.x < last.x + last.w && b.x + b.w > last.x;
			return below && sameColumn;
		});
		if (run) run.push({ ...b });
		else runs.push([{ ...b }]);
	}
	// close vertical gaps between consecutive lines so the outline is one polygon
	for (const run of runs) {
		for (let i = 0; i < run.length - 1; i++) {
			const a = run[i];
			const b = run[i + 1];
			const mid = (a.y + a.h + b.y) / 2;
			a.h = mid - a.y;
			b.h = b.y + b.h - mid;
			b.y = mid;
		}
	}
	return runs;
}

type Pt = [number, number];

/** A sentence highlight as data: runs of padded line boxes that touch, before it becomes a path. */
export type Shape = Box[][];

/**
 * Padded, cleaned-up line boxes of a range. Lines of one run share their top/bottom edges (no
 * gaps, no slanted joins), and a left or right edge that differs from the neighbouring line by
 * less than `snap` is aligned to it: justified text ends a few tenths of a pixel apart per line,
 * and without snapping the outline gets tiny steps and slanted edges there.
 */
export function sentenceShape(boxes: Box[], { pad = 2, snap = 4 } = {}): Shape {
	return groupRuns(boxes).map((run) => {
		const lines = run.map((b) => ({ x: b.x - pad, y: b.y, w: b.w + 2 * pad, h: b.h }));
		lines[0].y -= pad;
		lines[0].h += pad;
		lines[lines.length - 1].h += pad;
		snapEdges(lines, snap);
		return lines;
	});
}

/** Align near-equal left and right edges of consecutive lines (to the outer one of the two). */
function snapEdges(lines: Box[], snap: number) {
	for (let i = 1; i < lines.length; i++) {
		const a = lines[i - 1];
		const b = lines[i];
		if (Math.abs(a.x - b.x) < snap) {
			const x = Math.min(a.x, b.x);
			a.w += a.x - x;
			b.w += b.x - x;
			a.x = b.x = x;
		}
		const ra = a.x + a.w;
		const rb = b.x + b.w;
		if (Math.abs(ra - rb) < snap) {
			const r = Math.max(ra, rb);
			a.w = r - a.x;
			b.w = r - b.x;
		}
	}
}

/**
 * Polygon of a run: down the right edges, back up the left edges. Only horizontal and vertical
 * segments: where two lines meet, the step happens exactly at their shared edge.
 */
function runPolygon(run: Box[]): Pt[] {
	const pts: Pt[] = [];
	for (const b of run) {
		pts.push([b.x + b.w, b.y], [b.x + b.w, b.y + b.h]);
	}
	for (let i = run.length - 1; i >= 0; i--) {
		const b = run[i];
		pts.push([b.x, b.y + b.h], [b.x, b.y]);
	}
	// drop repeated points and middle points of straight segments (lines with equal edges)
	const unique = pts.filter((p, i) => {
		const q = pts[(i - 1 + pts.length) % pts.length];
		return Math.abs(p[0] - q[0]) > 0.01 || Math.abs(p[1] - q[1]) > 0.01;
	});
	return unique.filter((p, i) => {
		const a = unique[(i - 1 + unique.length) % unique.length];
		const c = unique[(i + 1) % unique.length];
		const cross = (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]);
		return Math.abs(cross) > 0.01;
	});
}

/**
 * SVG path with rounded corners for a closed polygon. Convex corners round outwards, concave ones
 * (where a shorter line meets a longer one) round inwards; both use the same arc so the shape reads
 * as one soft blob. The radius shrinks to fit short edges (a step of 1 px gets a 0.5 px radius).
 */
function roundedPath(pts: Pt[], radius: number): string {
	const n = pts.length;
	if (n < 3) return '';
	const f = (v: number) => v.toFixed(2);
	let d = '';
	for (let i = 0; i < n; i++) {
		const prev = pts[(i - 1 + n) % n];
		const cur = pts[i];
		const next = pts[(i + 1) % n];
		const dIn = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
		const dOut = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
		const r = Math.min(radius, dIn / 2, dOut / 2);
		const inX = cur[0] + ((prev[0] - cur[0]) / dIn) * r;
		const inY = cur[1] + ((prev[1] - cur[1]) / dIn) * r;
		const outX = cur[0] + ((next[0] - cur[0]) / dOut) * r;
		const outY = cur[1] + ((next[1] - cur[1]) / dOut) * r;
		// clockwise turn (screen coordinates) = convex corner of a clockwise polygon
		const sweep =
			(cur[0] - prev[0]) * (next[1] - cur[1]) - (cur[1] - prev[1]) * (next[0] - cur[0]) > 0 ? 1 : 0;
		d += `${i === 0 ? 'M' : 'L'}${f(inX)} ${f(inY)} A${f(r)} ${f(r)} 0 0 ${sweep} ${f(outX)} ${f(outY)} `;
	}
	return `${d}Z`;
}

/** `d` attribute of a shape: one closed sub-path per run. */
export function shapePath(shape: Shape, radius = 5): string {
	return shape
		.map((run) => roundedPath(runPolygon(run), radius))
		.filter(Boolean)
		.join(' ');
}

/** One `d` attribute covering all runs of a range. */
export function outlinePath(boxes: Box[], { pad = 2, radius = 5, snap = 4 } = {}): string {
	return shapePath(sentenceShape(boxes, { pad, snap }), radius);
}

// --- motion ------------------------------------------------------------------------------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpBox = (a: Box, b: Box, t: number): Box => ({
	x: lerp(a.x, b.x, t),
	y: lerp(a.y, b.y, t),
	w: lerp(a.w, b.w, t),
	h: lerp(a.h, b.h, t)
});

/**
 * Interpolate between two sentence shapes. Runs are paired in order and lines within a run are
 * paired top to bottom; when one side has more lines, its extra lines grow out of (or collapse into)
 * the nearest line of the other side, so the outline stays one connected blob while it morphs.
 * A pair on the same visual line (the next sentence continues the line) does not slide as a rigid
 * block across the text: it stretches like the word cursor, capped at one box height.
 * Returns null when the shapes cannot be paired (different number of runs).
 */
export function morphShape(from: Shape, to: Shape): ((t: number) => Shape) | null {
	if (!from.length || from.length !== to.length) return null;
	const pairs = from.map((a, i) =>
		pairLines(a, to[i]).map(([x, y]) => {
			const along = x.h > 0 && y.h > 0 && sameLine(x, y);
			return (t: number) => (along ? stretchBox(x, y, t) : lerpBox(x, y, t));
		})
	);
	return (t) => pairs.map((run) => run.map((line) => line(t)));
}

/** Pair the lines of two runs; the shorter run repeats its last line, flattened to its bottom edge. */
function pairLines(a: Box[], b: Box[]): [Box, Box][] {
	const n = Math.max(a.length, b.length);
	const at = (run: Box[], i: number): Box => {
		if (i < run.length) return run[i];
		const last = run[run.length - 1];
		return { x: last.x, y: last.y + last.h, w: last.w, h: 0 };
	};
	return Array.from({ length: n }, (_, i) => [at(a, i), at(b, i)]);
}

/** Two word boxes sit on the same visual line: most of the shorter one overlaps the other vertically. */
export function sameLine(a: Box, b: Box) {
	const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
	return overlap > Math.min(a.h, b.h) * 0.5;
}

/**
 * Glide along a line with a soft stretch, capped at one box height rather than the distance
 * between targets. `t` is the eased progress 0..1.
 */
export function stretchBox(from: Box, to: Box, t: number): Box {
	const distance = Math.abs(to.x + to.w / 2 - from.x - from.w / 2);
	const extra = Math.min(distance, Math.max(from.h, to.h)) * 4 * t * (1 - t);
	const box = lerpBox(from, to, t);
	return { ...box, x: box.x - extra / 2, w: box.w + extra };
}

/** Rounded rectangle; the default radius nests inside the sentence's 5-unit arc with a 0.5-unit inset. */
export function wordPath(b: Box, { pad = 1.5, radius = 4.5 } = {}): string {
	const x = b.x - pad;
	const y = b.y - pad;
	const w = b.w + 2 * pad;
	const h = b.h + 2 * pad;
	return roundedPath(
		[
			[x + w, y],
			[x + w, y + h],
			[x, y + h],
			[x, y]
		],
		radius
	);
}

/** Several word parts (a word broken across lines) as one `d` attribute. */
export function wordPaths(boxes: Box[], opts?: { pad?: number; radius?: number }): string {
	return boxes.map((b) => wordPath(b, opts)).join(' ');
}
