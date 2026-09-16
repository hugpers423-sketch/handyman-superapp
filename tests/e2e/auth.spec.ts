import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should register a new client user', async ({ page }) => {
    await page.click('text=Registrarse');
    await expect(page).toHaveURL(/.*register/);
    
    await page.fill('[name="name"]', 'Test Client');
    await page.fill('[name="email"]', `client-${Date.now()}@test.com`);
    await page.fill('[name="password"]', 'TestPass123!');
    await page.fill('[name="confirmPassword"]', 'TestPass123!');
    await page.selectOption('[name="role"]', 'CLIENT');
    await page.fill('[name="phone"]', '+51987654321');
    await page.fill('[name="address"]', 'Av. Test 123, Lima');
    
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
    await expect(page.locator('text=Test Client')).toBeVisible();
  });

  test('should register a new professional user', async ({ page }) => {
    await page.click('text=Registrarse');
    await expect(page).toHaveURL(/.*register/);
    
    await page.fill('[name="name"]', 'Test Professional');
    await page.fill('[name="email"]', `pro-${Date.now()}@test.com`);
    await page.fill('[name="password"]', 'TestPass123!');
    await page.fill('[name="confirmPassword"]', 'TestPass123!');
    await page.selectOption('[name="role"]', 'PROFESSIONAL');
    await page.fill('[name="phone"]', '+51987654322');
    await page.fill('[name="address"]', 'Av. Pro 456, Lima');
    await page.fill('[name="specialty"]', 'Plomeria');
    await page.fill('[name="dni"]', '12345678');
    
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
    await expect(page.locator('text=Test Professional')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard|.*home/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'invalid@test.com');
    await page.fill('[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Credenciales inv')).toBeVisible();
  });
});