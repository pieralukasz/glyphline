import { defineConfig } from 'tsdown';

const shared = {
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	dts: true,
	sourcemap: true,
	fixedExtension: false
} as const;

export default defineConfig([
	{
		...shared,
		entry: {
			index: 'src/index.ts',
			'pdf/index': 'src/pdf/index.ts',
			'dom/index': 'src/dom/index.ts'
		},
		clean: true,
		deps: { neverBundle: ['pdfjs-dist'] }
	},
	{
		...shared,
		entry: { 'react/index': 'src/react/index.ts' },
		clean: false,
		// hooks and effects: a client module for React Server Components (Next.js App Router)
		banner: { js: '"use client";' },
		// the adapter imports the core by its public name, so both share one copy of it
		deps: { neverBundle: ['react', 'react/jsx-runtime', /^glyphline/] }
	}
]);
