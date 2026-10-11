// A TextSource for ordinary HTML: the text nodes under a root element, measured with DOM Ranges.
// Boxes follow live layout, so the highlighter re-measures on resize.

import type { TextRange } from '../core/segment.ts';
import { segment } from '../core/segment.ts';
import type { TextSource } from '../core/source.ts';
import type { Box } from '../core/types.ts';

export type DomSourceOptions = {
	/** locale for word and sentence segmentation, default the root's `lang` or "en" */
	locale?: string;
	/** elements whose text is left out, default `script, style, noscript, template, textarea, [data-glyphline-skip]` */
	skip?: string;
};

export interface DomTextSource extends TextSource {
	readonly root: Element;
	/** Character range of a DOM selection inside the root, or null. */
	rangeFromSelection(selection: Selection | null): TextRange | null;
	/** Character index under a viewport point (caret position), or -1. */
	charAtPoint(clientX: number, clientY: number): number;
	/** A DOM Range for a character range, e.g. to scroll it into view or copy it. */
	toRange(start: number, end: number): Range | null;
}

const SKIP = 'script, style, noscript, template, textarea, [data-glyphline-skip]';

/** Text node and its first character index in the source text. */
type Run = { node: Text; start: number };

/**
 * Read the text under `root`. Block boundaries (paragraphs, headings, list items) end a sentence
 * whatever the punctuation. Call it again (or `highlighter.setSource`) after the content changes.
 */
export function domSource(root: Element, options: DomSourceOptions = {}): DomTextSource {
	const skip = options.skip ?? SKIP;
	const locale =
		options.locale ?? (root.closest('[lang]')?.getAttribute('lang') || undefined) ?? 'en';
	const runs: Run[] = [];
	const breakAt: number[] = [];
	let text = '';

	const blockOf = new Map<Element, Element>();
	const block = (el: Element | null): Element | null => {
		if (!el) return null;
		const hit = blockOf.get(el);
		if (hit) return hit;
		let cur: Element | null = el;
		while (cur && cur !== root) {
			const display = getComputedStyle(cur).display;
			if (!display.startsWith('inline') && display !== 'contents') break;
			cur = cur.parentElement;
		}
		const b = cur ?? root;
		blockOf.set(el, b);
		return b;
	};

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) =>
			n.parentElement?.closest(skip) || !n.nodeValue
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT
	});
	let lastBlock: Element | null = null;
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const node = n as Text;
		const b = block(node.parentElement);
		if (lastBlock && b !== lastBlock && text.length) {
			breakAt.push(text.length);
			// a separator between blocks, mapped to no node
			text += '\n';
			runs.push({ node: null as unknown as Text, start: text.length - 1 });
		}
		lastBlock = b;
		runs.push({ node, start: text.length });
		// whitespace collapses in layout; keep one char per char so offsets stay 1:1 with the node
		text += (node.nodeValue ?? '').replace(/\s/g, ' ');
	}
	const textRuns = runs.filter((r) => r.node);
	const { words, sentences } = segment(text, { breakAt, locale });

	/** run that contains char `i` (last run starting at or before it) */
	const runAt = (i: number) => {
		let lo = 0;
		let hi = textRuns.length - 1;
		let found = -1;
		while (lo <= hi) {
			const mid = (lo + hi) >> 1;
			if (textRuns[mid].start <= i) {
				found = mid;
				lo = mid + 1;
			} else hi = mid - 1;
		}
		return found;
	};

	const toRange = (start: number, end: number): Range | null => {
		if (end <= start) return null;
		let a = runAt(start);
		let b = runAt(end - 1);
		if (a < 0 || b < 0) return null;
		// a range that starts on a block separator starts on the next node
		const len = (k: number) => textRuns[k].node.length;
		let so = start - textRuns[a].start;
		if (so >= len(a) && a + 1 < textRuns.length) {
			a += 1;
			so = 0;
		}
		let eo = end - textRuns[b].start;
		if (eo > len(b)) eo = len(b);
		if (b < a) b = a;
		const r = document.createRange();
		r.setStart(textRuns[a].node, Math.min(so, len(a)));
		r.setEnd(textRuns[b].node, eo);
		return r;
	};

	const origin = (overlay: Element) => overlay.getBoundingClientRect();

	return {
		root,
		text,
		words,
		sentences,
		live: true,
		viewBox(overlay) {
			const r = origin(overlay);
			return { x: 0, y: 0, w: r.width || 1, h: r.height || 1 };
		},
		boxes(start, end, overlay) {
			const range = toRange(start, end);
			if (!range) return [];
			const o = origin(overlay);
			const rects = [...range.getClientRects()]
				.filter((r) => r.width > 0.5 && r.height > 0.5)
				.map((r) => ({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height }));
			return mergeFragments(rects);
		},
		rangeFromSelection(selection) {
			if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
			const r = selection.getRangeAt(0);
			let start = -1;
			let end = -1;
			for (const run of textRuns) {
				if (!r.intersectsNode(run.node)) continue;
				if (start < 0) start = run.start + (run.node === r.startContainer ? r.startOffset : 0);
				end = run.start + (run.node === r.endContainer ? r.endOffset : run.node.length);
			}
			return start >= 0 && end > start ? { start, end } : null;
		},
		charAtPoint(x, y) {
			const doc = root.ownerDocument as Document & {
				caretPositionFromPoint?: (
					x: number,
					y: number
				) => { offsetNode: Node; offset: number } | null;
			};
			let node: Node | null = null;
			let offset = 0;
			const pos = doc.caretPositionFromPoint?.(x, y);
			if (pos) {
				node = pos.offsetNode;
				offset = pos.offset;
			} else {
				const r = doc.caretRangeFromPoint?.(x, y);
				if (r) {
					node = r.startContainer;
					offset = r.startOffset;
				}
			}
			const run = textRuns.find((t) => t.node === node);
			return run ? run.start + offset : -1;
		},
		toRange
	};
}

/**
 * Join client rects of one line that touch (inline elements split a word into several rects) and
 * drop rects contained in another (a parent inline box and its text).
 */
export function mergeFragments(rects: Box[]): Box[] {
	const out: Box[] = [];
	for (const r of rects) {
		const last = out[out.length - 1];
		if (last) {
			const overlap = Math.min(last.y + last.h, r.y + r.h) - Math.max(last.y, r.y);
			const sameLine = overlap > Math.min(last.h, r.h) * 0.5;
			const gap = r.x - (last.x + last.w);
			if (sameLine && gap < 1 && r.x + r.w > last.x - 1) {
				const x = Math.min(last.x, r.x);
				const y = Math.min(last.y, r.y);
				last.w = Math.max(last.x + last.w, r.x + r.w) - x;
				last.h = Math.max(last.y + last.h, r.y + r.h) - y;
				last.x = x;
				last.y = y;
				continue;
			}
		}
		out.push({ ...r });
	}
	return out;
}
