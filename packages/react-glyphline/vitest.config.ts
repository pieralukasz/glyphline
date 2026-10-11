import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 20_000,
		include: ['tests/**/*.test.{ts,tsx}'],
		// one pre-bundled copy of React for the components and react-dom
		deps: {
			optimizer: { web: { include: ['react', 'react-dom/client', 'react/jsx-dev-runtime'] } }
		},
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
