import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration Playwright pour EAUMALIK SaaS.
 *
 * Usage :
 *   npx playwright install chromium    # une seule fois
 *   npm run e2e                       # tous les tests (chromium)
 *   npm run e2e -- --headed           # avec navigateur visible
 *   npm run e2e -- locations.spec.ts  # un seul fichier
 *
 * Variables d'env attendues :
 *   BASE_URL         (défaut: http://localhost:3000)
 *   TEST_ADMIN_EMAIL (ex. eaumaliksarl@gmail.com)
 *   TEST_ADMIN_PASS  (mot de passe du compte admin test)
 *
 * Le serveur Next.js doit tourner sur $BASE_URL avant de lancer les tests.
 * En CI on utilise `webServer` pour démarrer automatiquement.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,        // évite les race conditions sur la DB partagée
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Webserver : on démarre Next.js automatiquement si pas déjà en cours.
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL ?? 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});