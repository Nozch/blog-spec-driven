import { test, expect } from '@playwright/test';

test.describe('Compose & publish flow (US1)', () => {
  test('author can compose, style, tag, and publish in one session', async ({ page }) => {
    await page.goto('/compose');

    // Fill basic article fields
    await page.getByLabel('Title').fill('Playwright compose test');
    await page.getByTestId('editor-body').fill('## Automated draft\n\nThis draft was created by Playwright.');

    // Adjust appearance controls
    await page.getByLabel('Font size').selectOption('18');
    await page.getByLabel('Left padding').fill('32');

    // Tag suggestions editable
    await page.getByTestId('tag-suggestion-chip').first().click();
    await page.getByPlaceholder('Add custom tag').fill('playwright');
    await page.keyboard.press('Enter');

    // Publish directly without import
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Publish scheduled')).toBeVisible();
    await expect(page.getByRole('status', { name: 'draft-saved' })).toHaveText('Draft saved');
  });
});
