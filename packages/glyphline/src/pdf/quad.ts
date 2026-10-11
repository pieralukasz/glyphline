/** Axis-aligned box around a set of points. */
export function quadBox(q: [number, number][]) {
	const xs = q.map((p) => p[0]);
	const ys = q.map((p) => p[1]);
	const x = Math.min(...xs);
	const y = Math.min(...ys);
	return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
