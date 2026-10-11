export {
	createHighlighter,
	type Highlighter,
	type HighlighterOptions,
	type HighlightState,
	type Mark,
	type SelectionOptions,
	type ShapeOptions,
	snapToWords,
	type Target
} from './core/highlighter.ts';
export {
	easeOutCubic,
	interpolateSentence,
	interpolateWord,
	type SentenceFrame,
	sentenceFrame,
	travelBox,
	type WordFrame
} from './core/motion.ts';
export {
	groupRuns,
	mergeLines,
	morphShape,
	outlinePath,
	type Shape,
	sameLine,
	sentenceShape,
	shapePath,
	stretchBox,
	wordPath,
	wordPaths
} from './core/outline.ts';
export {
	type Segmented,
	type SegmentOptions,
	type Sentence,
	segment,
	type TextRange,
	type Word,
	wordAt
} from './core/segment.ts';
export { sentenceRange, type TextSource, wordRange } from './core/source.ts';
export type { Box } from './core/types.ts';
