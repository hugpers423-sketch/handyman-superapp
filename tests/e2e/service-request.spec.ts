import { test, expect } from '@playwright/test';

test.describe('Service Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
  });

  test('should create a new service request', async ({ page }) => {
    await page.click('text=Solicitar Servicio');
    await expect(page).toHaveURL(/.*service-request|.*new-service/);
    
    await page.selectOption('[name="category"]', 'PLUMBING');
    await page.fill('[name="title"]', 'Fuga de agua en cocina');
    await page.fill('[name="description"]', 'Tengo una fuga en el grifo de la cocina que necesita reparación urgente.');
    await page.fill('[name="address"]', 'Av. Test 123, Lima');
    await page.fill('[name="preferredDate"]', '2024-12-20');
    await page.fill('[name="preferredTime"]', '10:00');
    await page.fill('[name="budget"]', '150');
    
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Solicitud creada')).toBeVisible();
    await expect(page.locator('text=Fuga de agua en cocina')).toBeVisible();
  });

  test('should view service request details', async ({ page }) => {
    await page.goto('/my-requests');
    await expect(page.locator('[data-testid="service-request-card"]').first()).toBeVisible();
    await page.click('[data-testid="service-request-card"] >> nth=0');
    await expect(page).toHaveURL(/.*request\/.*/);
    await expect(page.locator('text=Detalles de la solicitud')).toBeVisible();
  });

  test('should cancel a pending service request', async ({ page }) => {
    await page.goto('/my-requests');
    const firstCard = page.locator('[data-testid="service-request-card"]').first();
    await firstCard.click();
    await page.click('text=Cancelar solicitud');
    await page.click('text=Confirmar cancelación');
    await expect(page.locator('text=Solicitud cancelada')).toBeVisible();
  });
});