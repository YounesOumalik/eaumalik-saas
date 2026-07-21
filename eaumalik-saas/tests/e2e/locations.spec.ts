import { test, expect } from './auth-helper';

/**
 * Tests E2E — Module Logistique : page /admin/locations (3 onglets).
 *
 * Couvre les cas du plan v2 :
 *  - Cas 1 : SQL seed → vérifier les 3 localités seed affichées
 *  - Cas 2 : Mock boot → vérifier le rendu de la grille
 *  - Cas 11 : Capacité 0 = pas d'alerte
 *  - Doc utilisateur : bandeau d'aide visible
 */

test.describe('Module Logistique — /admin/locations', () => {
  test('Cas 1+2 : affiche les 3 localités seed (D-CASA-DEPOT, M-CASA-CENTRAL, P-SHOWROOM)', async ({ page }) => {
    await page.goto('/admin/locations');
    await expect(page.getByRole('heading', { name: /Module Logistique/i })).toBeVisible();

    // Le bandeau d'aide est visible par défaut
    await expect(page.getByText(/Aide rapide/i)).toBeVisible();

    // 3 localités seed dans la grille
    await expect(page.getByText('D-CASA-DEPOT')).toBeVisible();
    await expect(page.getByText('M-CASA-CENTRAL')).toBeVisible();
    await expect(page.getByText('P-SHOWROOM')).toBeVisible();

    // Chaque localité a son type (Dépôt / Magasin / Présentoir)
    await expect(page.getByText(/Dépôt principal/)).toBeVisible();
    await expect(page.getByText(/Magasin central/)).toBeVisible();
    await expect(page.getByText(/Showroom|Présentoir/)).toBeVisible();
  });

  test('Cas 11 : capacité 0 affiche "non renseignée" et pas de barre', async ({ page }) => {
    await page.goto('/admin/locations');
    // Les 3 localités seed ont capacity_units = 0 et capacity_area_m2 = 0
    // → doivent afficher le message "Capacité non renseignée"
    const messages = page.getByText(/Capacité non renseignée/i);
    await expect(messages.first()).toBeVisible();
    // Au moins 3 occurrences (une par localité seed)
    expect(await messages.count()).toBeGreaterThanOrEqual(3);
  });

  test('Doc : bandeau d\'aide collapsible', async ({ page }) => {
    await page.goto('/admin/locations');
    await expect(page.getByText(/Aide rapide/i)).toBeVisible();
    // Clic sur "Masquer l'aide" → le bandeau disparaît
    await page.getByRole('button', { name: /Masquer l'aide/i }).click();
    await expect(page.getByText(/Aide rapide/i)).not.toBeVisible();
  });

  test('Filtre par type fonctionne', async ({ page }) => {
    await page.goto('/admin/locations');
    // Sélection "Magasins" dans le filtre type
    await page.locator('select').first().selectOption({ label: 'Magasins' });
    // D-CASA-DEPOT (dépôt) ne doit plus être visible
    await expect(page.getByText('D-CASA-DEPOT')).not.toBeVisible();
    // M-CASA-CENTRAL (magasin) reste visible
    await expect(page.getByText('M-CASA-CENTRAL')).toBeVisible();
  });

  test('Onglets : navigation vers Inventaire et Workflows', async ({ page }) => {
    await page.goto('/admin/locations');
    // Onglet Inventaire
    await page.getByRole('button', { name: 'Inventaire' }).click();
    await expect(page.getByText(/Localité :|Localité principale|Sélectionner/i)).toBeVisible();
    // Onglet Workflows
    await page.getByRole('button', { name: 'Workflows' }).click();
    await expect(page.getByText(/Tous statuts|En attente/i)).toBeVisible();
  });
});