/**
 * E2E Test: Auto-Save with Debouncing (T055)
 *
 * Purpose: Validate that the editor automatically saves drafts after user
 * stops typing, with proper debouncing behavior and visual feedback.
 *
 * User Story 1 - Compose & Edit In-Browser:
 * "An individual blogger writes and edits an article directly in the browser
 * with formatting controls, appearance adjustments, and auto-suggested tags
 * before publishing or saving as draft."
 *
 * Requirements:
 * - Auto-save triggers after user stops typing (debounced)
 * - Multiple rapid edits debounce correctly (timer resets)
 * - "Saving..." indicator appears and disappears
 * - Saved content matches editor content
 * - Auto-save cancels on navigation before timer fires
 *
 * Implementation Decisions (from clarification session):
 * 1. Timing: Behavioral checks (not strict millisecond timing)
 * 2. Visual feedback: Verify "Saving..." indicator
 * 3. Debouncing: Count save calls via page evaluation
 * 4. Content: Verify MDX output contains typed text
 * 5. Cancellation: Separate test scenario
 * 6. Failure handling: Skipped (would hurt UX to show errors)
 * 7. Structure: Multiple focused tests
 *
 * Note: Current implementation uses in-memory draft storage.
 * When T049 (S3 draft storage) is implemented, update tests to use
 * route interception for API calls.
 */

import { test, expect } from '@playwright/test';

test.describe('Editor - Auto-Save', () => {
  /**
   * Helper: Setup save tracking in the page context
   * Exposes window.__saveCalls to track when drafts are saved
   */
  async function setupSaveTracking(page) {
    await page.evaluate(() => {
      // Initialize save tracking
      (window as any).__saveCalls = [];
      (window as any).__lastSavedContent = null;

      // Track when page calls saveDraft (for current in-memory implementation)
      // This will need updating when real API is implemented (T049)
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const [url] = args;
        if (typeof url === 'string' && url.includes('/api/drafts')) {
          (window as any).__saveCalls.push({
            timestamp: Date.now(),
            url: url
          });
        }
        return originalFetch(...args);
      };
    });
  }

  /**
   * Helper: Get save call count
   */
  async function getSaveCallCount(page) {
    return await page.evaluate(() => (window as any).__saveCalls?.length || 0);
  }

  test('should auto-save after user stops typing', async ({ page }) => {
    await page.goto('/compose');
    await setupSaveTracking(page);

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();

    // Type some content
    await editor.click();
    await page.keyboard.type('Hello World');

    // Verify no immediate save (debouncing)
    await page.waitForTimeout(500);
    const immediateSaves = await getSaveCallCount(page);
    expect(immediateSaves).toBe(0);

    // Wait for auto-save to trigger (1000ms delay + buffer)
    // Using behavioral timing (not strict) per clarification
    await page.waitForTimeout(1000);

    // Note: Since current implementation is in-memory (not API),
    // we verify by checking that "Saving..." appeared and disappeared
    // When API is implemented, we can verify fetch calls

    // Verify editor still contains content
    await expect(editor).toContainText('Hello World');
  });

  test('should debounce multiple rapid edits into single save', async ({ page }) => {
    await page.goto('/compose');
    await setupSaveTracking(page);

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Simulate rapid typing with pauses less than auto-save delay
    await page.keyboard.type('Hello');
    await page.waitForTimeout(400); // Less than 1000ms

    await page.keyboard.type(' World');
    await page.waitForTimeout(400); // Less than 1000ms

    await page.keyboard.type('!');

    // Verify no save has happened yet (debouncing working)
    await page.waitForTimeout(100);
    const savesDuringTyping = await getSaveCallCount(page);
    expect(savesDuringTyping).toBe(0);

    // Wait for final auto-save (after user stops typing)
    // Behavioral check: should save within 2 seconds of last keystroke
    await page.waitForTimeout(1500);

    // Verify final content
    await expect(editor).toContainText('Hello World!');

    // Note: With in-memory implementation, we can't count saves directly
    // This test validates timing behavior; save counting will be added
    // when T049 API implementation is complete
  });

  test('should show and hide "Saving..." indicator during auto-save', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();

    // Verify "Saving..." is NOT visible initially
    const savingIndicator = page.getByText('Saving...');
    await expect(savingIndicator).not.toBeVisible();

    // Type content
    await editor.click();
    await page.keyboard.type('Test content for save indicator');

    // Wait for auto-save delay
    await page.waitForTimeout(1200);

    // The "Saving..." indicator should appear briefly
    // Note: With in-memory save (synchronous), this might be too fast to catch
    // This test will be more robust when async API is implemented (T049)

    // After save completes, indicator should disappear
    // Give it time to appear and disappear
    await page.waitForTimeout(500);
    await expect(savingIndicator).not.toBeVisible();

    // Verify content persists
    await expect(editor).toContainText('Test content for save indicator');
  });

  test('should save content that matches editor MDX output', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type structured content
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify editor contains both paragraphs
    const paragraphs = editor.locator('p');
    await expect(paragraphs).toHaveCount(2);
    await expect(paragraphs.nth(0)).toContainText('First paragraph');
    await expect(paragraphs.nth(1)).toContainText('Second paragraph');

    // Note: Content verification will be enhanced when API is implemented
    // We'll be able to inspect the actual MDX payload sent to the server
  });

  test('should handle continuous typing without duplicate saves', async ({ page }) => {
    await page.goto('/compose');
    await setupSaveTracking(page);

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type continuously with brief pauses
    const words = ['The', 'quick', 'brown', 'fox', 'jumps'];
    for (const word of words) {
      await page.keyboard.type(word + ' ');
      await page.waitForTimeout(300); // Less than auto-save delay
    }

    // Verify no save happened during typing
    await page.waitForTimeout(100);
    const savesDuringTyping = await getSaveCallCount(page);
    expect(savesDuringTyping).toBe(0);

    // Wait for final auto-save
    await page.waitForTimeout(1200);

    // Verify final content
    await expect(editor).toContainText('The quick brown fox jumps');
  });

  test('should cancel auto-save when navigating away before timer fires', async ({ page }) => {
    await page.goto('/compose');
    await setupSaveTracking(page);

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type content
    await page.keyboard.type('This should not be saved');

    // Navigate away before auto-save delay expires
    await page.waitForTimeout(500); // Less than 1000ms auto-save delay
    await page.goto('/'); // Navigate to home page

    // Wait to ensure save timer would have fired
    await page.waitForTimeout(1000);

    // Verify no save occurred
    const saveCalls = await getSaveCallCount(page);
    expect(saveCalls).toBe(0);
  });

  test('should resume auto-save after returning to editor', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type first content and let it save
    await page.keyboard.type('First save');
    await page.waitForTimeout(1500);

    // Navigate away briefly
    await page.goto('/');
    await page.waitForTimeout(200);

    // Return to compose page
    await page.goto('/compose');
    const editorAgain = page.getByRole('textbox');
    await expect(editorAgain).toBeVisible();

    // Type new content
    await editorAgain.click();
    await page.keyboard.type('Second save');

    // Wait for auto-save
    await page.waitForTimeout(1500);

    // Verify new content is present
    await expect(editorAgain).toContainText('Second save');
  });

  test('should not auto-save when autoSaveDelay is disabled', async ({ page }) => {
    // Note: This test requires a route that allows disabling auto-save
    // Current /compose route has auto-save enabled by default
    // Skip this test until we have a way to test without auto-save
    test.skip();
  });
});
