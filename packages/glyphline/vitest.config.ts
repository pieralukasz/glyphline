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
					include: ['tests/browser/**/*.test.ts'],
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
