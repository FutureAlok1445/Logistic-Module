import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/browser', fullyParallel: false, workers: 1, retries: 0, timeout: 45000, reporter: 'list', use: { baseURL: 'http://localhost:3000', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
