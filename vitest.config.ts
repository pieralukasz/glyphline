import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		testTimeout: 20_000,
		projects: [
			{ test: { name: 'node', include: ['tests/*.test.ts'] } },
			{
				test: {
					name: 'browser',
					include: ['tests/browser/**/*.test.{ts,tsx}'],
					// one pre-bundled copy of React for the hook and react-dom
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
			}
		]
	}
});
