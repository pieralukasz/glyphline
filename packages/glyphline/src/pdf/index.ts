export {
	type CharGeometry,
	type Glyph,
	geometryFromGlyphs,
	geometryFromItems,
	geometryFromTextLayer,
	type HybridGeometry,
	type MethodId,
	type Provenance,
	partBoxes,
	withFallback,
	wordBoxes
} from './geometry.ts';
export {
	type FontMetrics,
	type GlyphWalkInput,
	type OperatorList,
	walkGlyphs
} from './glyph-walk.ts';
export { type PdfSourceOptions, type PdfTextSource, pdfSource } from './source.ts';
export {
	buildPageText,
	type PageText,
	type TextItem,
	type WordPart,
	wordAt,
	wordParts
} from './text-model.ts';
