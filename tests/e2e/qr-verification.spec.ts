import { test, expect } from '@playwright/test';

test.describe('QR Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'pro@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
  });

  test('should display professional QR credential', async ({ page }) => {
    await page.goto('/pro/credencial');
    await expect(page.locator('text=Credencial Profesional')).toBeVisible();
    await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
    await expect(page.locator('text=Código de verificación:')).toBeVisible();
  });

  test('should scan client QR and verify identity', async ({ page }) => {
    await page.goto('/pro/verificar');
    await expect(page.locator('text=Verificar Cliente')).toBeVisible();
    
    await page.fill('[name="clientCode"]', 'ABC123');
    await page.click('button:has-text("Verificar")');
    await expect(page.locator('text=Verificación exitosa')).toBeVisible();
    await expect(page.locator('text=Cliente verificado')).toBeVisible();
  });

  test('should show error for invalid verification code', async ({ page }) => {
    await page.goto('/pro/verificar');
    await page.fill('[name="clientCode"]', 'INVALID');
    await page.click('button:has-text("Verificar")');
    await expect(page.locator('text=Código inv')).toBeVisible();
  });

  test('should display verification history', async ({ page }) => {
    await page.goto('/pro/verificaciones');
    await expect(page.locator('text=Historial de Verificaciones')).toBeVisible();
    await expect(page.locator('[data-testid="verification-row"]').first()).toBeVisible();
  });
});