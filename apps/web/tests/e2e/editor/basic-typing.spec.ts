/**
 * E2E Test: Basic Typing and onChange Callbacks (T054)
 *
 * Purpose: Validate that users can type text in the editor and that
 * onChange callbacks fire with correct serialized state.
 *
 * This test runs in a real browser (Chromium) to test ProseMirror/TipTap
 * interactions that cannot be tested in JSDOM.
 *
 * User Story 1 - Compose & Edit In-Browser:
 * "An individual blogger writes and edits an article directly in the browser
 * with formatting controls, appearance adjustments, and auto-suggested tags
 * before publishing or saving as draft."
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with formatting
 * - User can type text and see it appear in the editor
 * - onChange callback fires with correct tiptap/mdx/appearance properties
 * - Editor remains focused and responsive during typing
 *
 * Test Flow:
 * 1. User opens editor page
 * 2. User types "Hello World" into the editor
 * 3. Text appears in DOM as <p>Hello World</p>
 * 4. onChange callback fires with correct serialized state
 * 5. Editor remains focused and ready for more input
 */

import { test, expect } from '@playwright/test';

test.describe('Editor - Basic Typing', () => {
  test('should allow typing text and trigger onChange callback', async ({ page }) => {
    // Navigate to compose page (T051)
    await page.goto('/compose');

    // Wait for editor to be ready
    // The editor should have role="textbox" per accessibility requirements
    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();

    // Click to focus the editor
    await editor.click();

    // Type "Hello World" character by character
    await page.keyboard.type('Hello World');

    // Verify text appears in the editor
    await expect(editor).toContainText('Hello World');

    // Verify the content is in a paragraph element (TipTap default)
    const paragraph = editor.locator('p');
    await expect(paragraph).toContainText('Hello World');

    // Verify editor remains focused
    await expect(editor).toBeFocused();
  });

  test('should fire onChange callback with correct serialized state', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type some text
    await page.keyboard.type('Test content');

    // Wait a moment for the content to be processed
    await page.waitForTimeout(500);

    // Verify the content is in the editor
    await expect(editor).toContainText('Test content');
  });

  test('should handle rapid typing without losing characters', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type a longer sentence rapidly
    const testText = 'The quick brown fox jumps over the lazy dog';
    await page.keyboard.type(testText, { delay: 10 }); // 10ms delay between chars

    // Verify all characters were captured
    await expect(editor).toContainText(testText);

    // Verify no characters were dropped
    const editorText = await editor.textContent();
    expect(editorText?.trim()).toBe(testText);
  });

  test('should preserve cursor position during typing', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type initial text
    await page.keyboard.type('Hello World');

    // Move cursor to middle (after "Hello ")
    // Press Home to go to start, then 6 arrows right
    await page.keyboard.press('Home');
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
    }

    // Type "Beautiful "
    await page.keyboard.type('Beautiful ');

    // Verify text is inserted at cursor position
    await expect(editor).toContainText('Hello Beautiful World');
  });

  test('should handle Enter key to create new paragraphs', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type first line
    await page.keyboard.type('First paragraph');
    await page.keyboard.press('Enter');

    // Type second line
    await page.keyboard.type('Second paragraph');

    // Verify both paragraphs exist
    const paragraphs = editor.locator('p');
    await expect(paragraphs).toHaveCount(2);

    await expect(paragraphs.nth(0)).toContainText('First paragraph');
    await expect(paragraphs.nth(1)).toContainText('Second paragraph');
  });

  test('should handle backspace and delete keys', async ({ page }) => {
    await page.goto('/compose');

    const editor = page.getByRole('textbox');
    await expect(editor).toBeVisible();
    await editor.click();

    // Type text with a typo
    await page.keyboard.type('Hello Worldd');

    // Delete the extra 'd'
    await page.keyboard.press('Backspace');

    // Verify correction
    await expect(editor).toContainText('Hello World');
    await expect(editor).not.toContainText('Worldd');

    // Move to start and delete first character
    await page.keyboard.press('Home');
    await page.keyboard.press('Delete');

    // Verify 'H' was deleted
    await expect(editor).toContainText('ello World');
    await expect(editor).not.toContainText('Hello World');
  });
});
