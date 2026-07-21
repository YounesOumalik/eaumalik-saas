import { test, expect, loginAsAdmin } from './auth-helper';

/**
 * Tests E2E — Workflow de transfert de stock.
 *
 * Couvre les cas du plan v2 :
 *  - Cas 3 : Transfert direct admin E2E (mock : 2 localités + transférer)
 *  - Cas 5+6 : Validation administrator + superadmin
 *  - Cas 18 : Annulation d'une demande
 */

test.describe('Module Logistique — Workflows de transfert', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/locations');
    await page.getByRole('button', { name: 'Workflows' }).click();
  });

  test('Cas 3 : crée une demande de transfert (admin)', async ({ page }) => {
    // Aller sur l'onglet Inventaire pour créer un transfert
    await page.getByRole('button', { name: 'Inventaire' }).click();
    // Sélectionner la 1re localité disponible
    await page.locator('select').first().selectOption({ index: 1 });
    // Attendre que la table se charge
    await page.waitForTimeout(500);

    // Cliquer sur le bouton Transférer (s'il y a du stock)
    const transferBtn = page.getByRole('button', { name: /Transférer/i }).first();
    if (await transferBtn.isVisible()) {
      await transferBtn.click();
      // Le dialog s'ouvre
      await expect(page.getByText(/Demande de transfert/i)).toBeVisible();
      // Remplir la destination
      await page.locator('select').nth(1).selectOption({ index: 1 });
      await page.locator('input[type="number"]').fill('2');
      await page.getByRole('button', { name: /Créer la demande/i }).click();
      // Toast de succès
      await expect(page.getByText(/Demande de transfert créée/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('Cas 5 : approuve une demande pending', async ({ page }) => {
    // Vérifier qu'il y a au moins une demande pending
    const pendingBadge = page.getByText(/En attente/i).first();
    if (await pendingBadge.isVisible()) {
      // Trouver la ligne parente et cliquer Approuver
      const approveBtn = page.getByRole('button', { name: /Approuver/i }).first();
      await approveBtn.click();
      // Toast
      await expect(page.getByText(/Demande approuvée/i)).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('Cas 6 : rejette une demande pending avec commentaire obligatoire', async ({ page }) => {
    const pendingBadge = page.getByText(/En attente/i).first();
    if (await pendingBadge.isVisible()) {
      // Mock le prompt window
      page.on('dialog', (dialog) => {
        if (dialog.type() === 'prompt') {
          dialog.accept('Stock insuffisant, à reconsidérer');
        }
      });
      const rejectBtn = page.getByRole('button', { name: /Rejeter/i }).first();
      await rejectBtn.click();
      await expect(page.getByText(/Demande rejetée/i)).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('Cas 18 : annule une demande en attente', async ({ page }) => {
    // Accepter le confirm
    page.on('dialog', (dialog) => {
      if (dialog.type() === 'confirm') dialog.accept();
    });
    const cancelBtn = page.getByRole('button', { name: 'Annuler' }).first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.getByText(/Demande annulée/i)).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('Exécute une demande approved', async ({ page }) => {
    const executeBtn = page.getByRole('button', { name: /Exécuter/i }).first();
    if (await executeBtn.isVisible()) {
      await executeBtn.click();
      await expect(page.getByText(/Transfert exécuté/i)).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });
});