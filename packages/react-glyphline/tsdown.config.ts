import { defineConfig } from 'tsdown';

export default defineConfig({
	entry: ['src/index.ts'],
	format: 'esm',
	platform: 'browser',
	target: 'es2022',
	dts: true,
	clean: true,
	sourcemap: true,
	fixedExtension: false,
	// hooks and effects: a client module for React Server Components (Next.js App Router)
	banner: { js: '"use client";' },
	deps: { neverBundle: ['react', 'react/jsx-runtime', /^glyphline/] }
});
