import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'pdf/index': 'src/pdf/index.ts',
		'dom/index': 'src/dom/index.ts'
	},
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	dts: true,
	clean: true,
	sourcemap: true,
	fixedExtension: false,
	deps: { neverBundle: ['pdfjs-dist'] }
});
