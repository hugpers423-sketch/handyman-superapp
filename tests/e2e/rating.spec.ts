import { test, expect } from '@playwright/test';

test.describe('Rating & Review Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
  });

  test('should rate a completed service', async ({ page }) => {
    await page.goto('/my-requests');
    const completedRequest = page.locator('[data-testid="service-request-card"][data-status="COMPLETED"]').first();
    await expect(completedRequest).toBeVisible();
    await completedRequest.click();
    
    await page.click('text=Calificar servicio');
    await expect(page.locator('text=Califica tu experiencia')).toBeVisible();
    
    await page.click('[data-testid="star-5"]');
    await page.fill('[name="comment"]', 'Excelente servicio, muy profesional y puntual.');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Gracias por tu calificación')).toBeVisible();
  });

  test('should view professional ratings', async ({ page }) => {
    await page.goto('/professionals/123');
    await expect(page.locator('text=Calificaciones')).toBeVisible();
    await expect(page.locator('[data-testid="rating-card"]').first()).toBeVisible();
    await expect(page.locator('text=Promedio:')).toBeVisible();
  });

  test('should not allow rating non-completed services', async ({ page }) => {
    await page.goto('/my-requests');
    const pendingRequest = page.locator('[data-testid="service-request-card"][data-status="PENDING"]').first();
    await expect(pendingRequest).toBeVisible();
    await pendingRequest.click();
    await expect(page.locator('text=Calificar servicio')).not.toBeVisible();
  });
});