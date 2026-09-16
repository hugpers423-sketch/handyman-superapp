import { test, expect } from '@playwright/test';

test.describe('Protection & Insurance Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'pro@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
  });

  test('should display protection dashboard with coverage status', async ({ page }) => {
    await page.goto('/pro/proteccion');
    await expect(page.locator('text=Protección Laboral')).toBeVisible();
    await expect(page.locator('text=Cobertura actual')).toBeVisible();
    await expect(page.locator('[data-testid="coverage-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="contributions-count"]')).toBeVisible();
  });

  test('should show contribution history', async ({ page }) => {
    await page.goto('/pro/proteccion/aportes');
    await expect(page.locator('text=Historial de Aportes')).toBeVisible();
    await expect(page.locator('[data-testid="contribution-row"]').first()).toBeVisible();
    await expect(page.locator('text=3%')).toBeVisible();
  });

  test('should display claims/siniestros page', async ({ page }) => {
    await page.goto('/pro/proteccion/siniestros');
    await expect(page.locator('text=Mis Siniestros')).toBeVisible();
    await expect(page.locator('text=Reportar siniestro')).toBeVisible();
  });

  test('should file a new claim', async ({ page }) => {
    await page.goto('/pro/proteccion/siniestros');
    await page.click('text=Reportar siniestro');
    await expect(page).toHaveURL(/.*nuevo-siniestro/);
    
    await page.selectOption('[name="type"]', 'ACCIDENT');
    await page.fill('[name="description"]', 'Caída en obra, lesión en rodilla');
    await page.fill('[name="date"]', '2024-12-15');
    await page.fill('[name="location"]', 'Av. Obra 789, Lima');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Siniestro reportado')).toBeVisible();
  });

  test('should show protection admin dashboard (admin only)', async ({ page }) => {
    await page.goto('/admin/proteccion');
    await expect(page.locator('text=Panel de Administración')).toBeVisible();
    await expect(page.locator('[data-testid="stats-total-affiliates"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-total-contributions"]')).toBeVisible();
    await expect(page.locator('[data-testid="stats-claims-pending"]')).toBeVisible();
  });
});