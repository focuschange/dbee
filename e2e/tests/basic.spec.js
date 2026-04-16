const { test, expect } = require('@playwright/test');

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('DBee');
});

test('menu bar is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.menubar')).toBeVisible();
});

test('schema tree is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#schema-tree')).toBeVisible();
});

test('editor is visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#editor-container')).toBeVisible();
});

test('File menu opens', async ({ page }) => {
  await page.goto('/');
  await page.click('.menu-trigger:has-text("File")');
  await expect(page.locator('.menu-dropdown:visible')).toBeVisible();
});

test('AI Settings dialog opens', async ({ page }) => {
  await page.goto('/');
  await page.click('.menu-trigger:has-text("AI")');
  await page.click('#btn-ai-settings');
  await expect(page.locator('#ai-settings-dialog')).toBeVisible();
});
