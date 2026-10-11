import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url));

// the adapters import the core by its public name: point it at the source
const alias = [
	{ find: /^glyphline$/, replacement: src('index.ts') },
	{ find: /^glyphline\/(pdf|dom|react|svelte)$/, replacement: src('$1/index.ts') }
];

const browser = (name: string) => ({
	enabled: true,
	headless: true,
	provider: playwright(),
	instances: [{ browser: 'chromium' as const, name: `${name} (chromium)` }]
});

export default defineConfig({
	resolve: { alias },
	test: {
		testTimeout: 20_000,
		projects: [
			{ resolve: { alias }, test: { name: 'node', include: ['tests/*.test.ts'] } },
			{
				resolve: { alias },
				test: {
					name: 'core-dom',
					include: ['tests/browser/**/*.test.ts'],
					browser: browser('core')
				}
			},
			{
				resolve: { alias },
				test: {
					name: 'react',
					include: ['tests/react/**/*.test.tsx'],
					// one pre-bundled copy of React for the components and react-dom
					deps: {
						optimizer: { web: { include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] } }
					},
					browser: browser('react')
				}
			},
			{
				plugins: [svelte()],
				resolve: { alias },
				test: {
					name: 'svelte',
					include: ['tests/svelte/**/*.test.ts'],
					browser: browser('svelte')
				}
			}
		]
	}
});
