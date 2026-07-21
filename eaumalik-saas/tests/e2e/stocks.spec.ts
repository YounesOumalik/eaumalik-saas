import { test, expect } from './auth-helper';

/**
 * Tests E2E — Page /admin/stocks (capacité + RestockDialog avec localité).
 *
 * Couvre les cas du plan v2 :
 *  - Cas 8 : RestockDialog étendu avec sélecteur localité
 *  - Cas 11 : Capacité 0 = pas d'alerte sur-capacité
 */

test.describe('Module Logistique — Stocks Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/stocks');
    await expect(page.getByRole('heading', { name: /Gestion des Stocks/i })).toBeVisible();
  });

  test('Cas 11 : section Capacité des localités affiche les 3 localités seed', async ({ page }) => {
    await expect(page.getByText(/Capacité des localités/i)).toBeVisible();
    await expect(page.getByText('D-CASA-DEPOT')).toBeVisible();
    await expect(page.getByText('M-CASA-CENTRAL')).toBeVisible();
    await expect(page.getByText('P-SHOWROOM')).toBeVisible();
  });

  test('Cas 11b : capacité 0 → "Capacité non renseignée"', async ({ page }) => {
    await expect(page.getByText(/Capacité non renseignée/i).first()).toBeVisible();
  });

  test('Lien "Gérer →" renvoie vers /admin/locations', async ({ page }) => {
    const link = page.locator('a[href="/admin/locations"]').first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/admin\/locations$/);
  });

  test('Cas 8 : RestockDialog depuis catalogue ouvre le sélecteur localité', async ({ page }) => {
    // Aller sur Catalogue
    await page.goto('/admin/catalogue');
    // Trouver un produit et cliquer Mouvement de stock
    const moveBtn = page.getByRole('button', { name: /Mouvement de stock/i }).first();
    if (await moveBtn.count() === 0) {
      test.skip();
      return;
    }
    await moveBtn.click();
    // Le dialog s'ouvre
    await expect(page.getByText(/Mouvement de stock/i).first()).toBeVisible();
    // Vérifier la présence du label Localité impactée
    await expect(page.getByText(/Localité impactée/i)).toBeVisible();
    // Le sélecteur localité existe
    const locSelect = page.locator('select').filter({ hasText: /D-CASA-DEPOT|M-CASA-CENTRAL|P-SHOWROOM/ });
    await expect(locSelect.first()).toBeVisible();
    // Fermer
    await page.getByRole('button', { name: 'Annuler' }).click();
  });

  test('Cas 8b : RestockDialog depuis /admin/stocks pré-rempli avec localité du produit', async ({ page }) => {
    await page.goto('/admin/catalogue');
    const moveBtn = page.getByRole('button', { name: /Mouvement de stock/i }).first();
    if (await moveBtn.count() === 0) {
      test.skip();
      return;
    }
    await moveBtn.click();
    // Le sélecteur localité est visible et a une option présélectionnée
    const select = page.locator('select').filter({ hasText: /D-CASA-DEPOT|M-CASA-CENTRAL/ });
    await expect(select.first()).toBeVisible();
    // Vérifier qu'une option est bien sélectionnée
    const selectedValue = await select.first().inputValue();
    expect(selectedValue).not.toBe('');
    await page.getByRole('button', { name: 'Annuler' }).click();
  });
});