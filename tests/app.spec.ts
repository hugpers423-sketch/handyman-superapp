import { test, expect } from '@playwright/test';

test.describe('Handyman Super App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load and show intro', async ({ page }) => {
    await expect(page.locator('.intro')).toBeVisible();
    await expect(page.locator('.intro-copy h1')).toContainText('Cualquier problema');
  });

  test('should skip intro and show main app', async ({ page }) => {
    await page.click('.intro-skip');
    await expect(page.locator('.intro')).toBeHidden();
    await expect(page.locator('.shell')).toBeVisible();
    await expect(page.locator('.brand')).toContainText('HANDYMAN');
  });

  test('should navigate between pages via header tabs', async ({ page }) => {
    await page.click('.intro-skip');
    
    await page.click('[data-page="pro"]');
    await expect(page.locator('#pro')).toHaveClass(/active/);
    await expect(page.locator('#pro-heading')).toContainText('Hola, Jorge');
    
    await page.click('[data-page="ops"]');
    await expect(page.locator('#ops')).toHaveClass(/active/);
    await expect(page.locator('#ops-heading')).toContainText('La ciudad está en marcha');
    
    await page.click('[data-page="empresa"]');
    await expect(page.locator('#empresa')).toHaveClass(/active/);
    await expect(page.locator('#empresa-heading')).toContainText('Una sola plataforma');
    
    await page.click('[data-page="cliente"]');
    await expect(page.locator('#cliente')).toHaveClass(/active/);
    await expect(page.locator('#cliente-heading')).toContainText('Cualquier problema');
  });

  test('should navigate between pages via footer tabs', async ({ page }) => {
    await page.click('.intro-skip');
    
    await page.click('.bottom-nav [data-page="pro"]');
    await expect(page.locator('#pro')).toHaveClass(/active/);
    
    await page.click('.bottom-nav [data-page="cliente"]');
    await expect(page.locator('#cliente')).toHaveClass(/active/);
  });

  test('should select service on cliente page', async ({ page }) => {
    await page.click('.intro-skip');
    
    await page.click('.service:has-text("Gasfitería")');
    await expect(page.locator('.service:has-text("Gasfitería")')).toHaveClass(/active/);
    
    await page.click('.service:has-text("Electricidad")');
    await expect(page.locator('.service:has-text("Electricidad")')).toHaveClass(/active/);
    await expect(page.locator('.service:has-text("Gasfitería")')).not.toHaveClass(/active/);
  });

  test('should create service request', async ({ page }) => {
    await page.click('.intro-skip');
    
    await page.click('.service:has-text("Gasfitería")');
    await page.fill('#detail', 'Fuga de agua en cocina');
    await page.click('#requestForm button[type="submit"]');
    
    await expect(page.locator('.toast.show')).toBeVisible();
    await expect(page.locator('.toast.show')).toContainText('Solicitud creada');
  });

  test('should show emergency mode', async ({ page }) => {
    await page.click('.intro-skip');
    
    await page.click('[data-emergency]');
    
    await expect(page.locator('#service')).toHaveValue('Gasfitería');
    await expect(page.locator('#detail')).toHaveValue('EMERGENCIA: necesito atención prioritaria');
    await expect(page.locator('.toast.show')).toContainText('Modo emergencia activado');
  });

  test('should accept task on pro page', async ({ page }) => {
    await page.click('.intro-skip');
    await page.click('[data-page="pro"]');
    
    const acceptButton = page.locator('.action[data-task-id]').first();
    await expect(acceptButton).toBeEnabled();
    await acceptButton.click();
    
    await expect(page.locator('.toast.show')).toContainText('Servicio añadido a tu agenda');
    await expect(acceptButton).toHaveText('Aceptado ✓');
    await expect(acceptButton).toBeDisabled();
  });

  test('should assign urgent on ops page', async ({ page }) => {
    await page.click('.intro-skip');
    await page.click('[data-page="ops"]');
    
    const assignButton = page.locator('[data-assign-urgent]').first();
    await expect(assignButton).toBeEnabled();
    await assignButton.click();
    
    await expect(page.locator('.toast.show')).toContainText('Rosa Alarcón fue asignada');
    await expect(assignButton).toHaveText('Asignada ✓');
    await expect(assignButton).toBeDisabled();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.click('.intro-skip');
    
    const headerTabs = page.locator('.role-switch [role="tab"]');
    await expect(headerTabs).toHaveCount(3);
    
    for (const tab of await headerTabs.all()) {
      await expect(tab).toHaveAttribute('aria-selected');
      await expect(tab).toHaveAttribute('aria-controls');
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('.intro-skip');
    
    await expect(page.locator('.service-grid')).toBeVisible();
    await expect(page.locator('.bottom')).toBeVisible();
    await expect(page.locator('.top')).toBeVisible();
  });
});