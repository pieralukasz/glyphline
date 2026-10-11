import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/index.ts',
		'pdf/index': 'src/pdf/index.ts',
		'dom/index': 'src/dom/index.ts',
		'react/index': 'src/react/index.ts',
		'svelte/index': 'src/svelte/index.ts'
	},
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	dts: true,
	clean: true,
	sourcemap: true,
	fixedExtension: false,
	deps: { neverBundle: ['react', 'react/jsx-runtime', 'pdfjs-dist'] }
});
