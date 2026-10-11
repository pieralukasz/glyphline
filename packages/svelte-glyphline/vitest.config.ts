import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [svelte()],
	test: {
		testTimeout: 20_000,
		include: ['tests/**/*.test.ts', 'tests/**/*.svelte.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
