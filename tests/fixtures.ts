import { test as base, Page } from '@playwright/test';

interface TestFixtures {
  authenticatedPage: Page;
  clientPage: Page;
  professionalPage: Page;
  adminPage: Page;
}

export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*home/);
    await use(page);
  },
  
  clientPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'client@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*home/);
    await use(page);
  },
  
  professionalPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'pro@test.com');
    await page.fill('[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*home/);
    await use(page);
  },
  
  adminPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'AdminPass123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard|.*home/);
    await use(page);
  },
});

export { expect } from '@playwright/test';