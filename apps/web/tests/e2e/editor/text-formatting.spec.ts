/**
 * E2E Test: Text Formatting (Bold/Italic) (T056)
 *
 * Purpose: Validate that users can apply text formatting (bold, italic) via
 * keyboard shortcuts and that the formatted content renders correctly.
 *
 * User Story 1 - Compose & Edit In-Browser:
 * "An individual blogger writes and edits an article directly in the browser
 * with formatting controls, appearance adjustments, and auto-suggested tags
 * before publishing or saving as draft."
 *
 * Requirements:
 * - FR-001: System MUST allow composing articles in-browser with bold, italic
 * - Keyboard shortcuts: Mod-b (bold), Mod-i (italic)
 * - Semantic HTML: <strong> for bold, <em> for italic
 * - Toggle behavior: Apply and remove formatting
 * - Selection-based: Format selected text
 *
 * Technical Context:
 * - Text styles implemented in packages/editor/src/extensions/text-styles.ts
 * - Bold: toggleBold() command, Mod-b shortcut, <strong> tag
 * - Italic: toggleItalic() command, Mod-i shortcut, <em> tag
 * - "Mod" key = Cmd on macOS, Ctrl on Windows/Linux (Playwright handles this)
 *
 * Note: Current implementation doesn't have a visual toolbar (T040 incomplete).
 * Tests focus on keyboard shortcuts. When toolbar is implemented, add
 * toolbar button click tests.
 */

import { test, expect } from '@playwright/test';

test.describe('Editor - Text Formatting', () => {
  /**
   * Test Group 1: Bold Formatting with Keyboard Shortcuts
   */
  test.describe('Bold Formatting (Mod-b)', () => {
    test('should apply bold formatting with Mod-b shortcut', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await expect(editor).toBeVisible();
      await editor.click();

      // Type text
      await page.keyboard.type('Hello World');

      // Select "World" (move cursor back 5 chars, shift+right 5 times)
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowLeft');
      }
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Shift+ArrowRight');
      }

      // Apply bold with Mod-b
      await page.keyboard.press('Meta+b'); // Mac: Cmd+b, Windows/Linux: Ctrl+b

      // Verify <strong> tag appears
      const strongElement = editor.locator('strong');
      await expect(strongElement).toBeVisible();
      await expect(strongElement).toContainText('World');

      // Verify "Hello" is not bold
      const paragraph = editor.locator('p');
      await expect(paragraph).toContainText('Hello');

      // Verify the structure: paragraph contains both text and strong tag
      const html = await paragraph.innerHTML();
      expect(html).toContain('Hello');
      expect(html).toContain('<strong>World</strong>');
    });

    test('should remove bold formatting when toggling with Mod-b', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type and select text
      await page.keyboard.type('Bold text');

      // Select all (Mod-a)
      await page.keyboard.press('Meta+a');

      // Apply bold
      await page.keyboard.press('Meta+b');

      // Verify bold applied
      let strongElement = editor.locator('strong');
      await expect(strongElement).toContainText('Bold text');

      // Keep selection and toggle bold off
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Meta+b');

      // Verify bold removed (strong tag should not exist)
      strongElement = editor.locator('strong');
      await expect(strongElement).toHaveCount(0);

      // Text should still be there
      await expect(editor).toContainText('Bold text');
    });

    test('should apply bold to multiple words', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type sentence
      await page.keyboard.type('The quick brown fox');

      // Select "quick brown" (position cursor after "The ", then shift-select)
      await page.keyboard.press('Home');
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('ArrowRight'); // After "The "
      }
      for (let i = 0; i < 11; i++) {
        await page.keyboard.press('Shift+ArrowRight'); // Select "quick brown"
      }

      // Apply bold
      await page.keyboard.press('Meta+b');

      // Verify
      const strongElement = editor.locator('strong');
      await expect(strongElement).toContainText('quick brown');

      // Verify structure
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();
      expect(html).toContain('The ');
      expect(html).toContain('<strong>quick brown</strong>');
      expect(html).toContain(' fox');
    });

    test('should apply bold while typing (no selection)', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type normal text
      await page.keyboard.type('Normal ');

      // Activate bold
      await page.keyboard.press('Meta+b');

      // Type bold text
      await page.keyboard.type('bold');

      // Deactivate bold
      await page.keyboard.press('Meta+b');

      // Type normal again
      await page.keyboard.type(' normal');

      // Verify structure
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();

      expect(html).toMatch(/Normal <strong>bold<\/strong> normal/);
    });
  });

  /**
   * Test Group 2: Italic Formatting with Keyboard Shortcuts
   */
  test.describe('Italic Formatting (Mod-i)', () => {
    test('should apply italic formatting with Mod-i shortcut', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type text
      await page.keyboard.type('Hello World');

      // Select "World"
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('ArrowLeft');
      }
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Shift+ArrowRight');
      }

      // Apply italic with Mod-i
      await page.keyboard.press('Meta+i');

      // Verify <em> tag appears
      const emElement = editor.locator('em');
      await expect(emElement).toBeVisible();
      await expect(emElement).toContainText('World');

      // Verify structure
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();
      expect(html).toContain('Hello');
      expect(html).toContain('<em>World</em>');
    });

    test('should remove italic formatting when toggling with Mod-i', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type and select
      await page.keyboard.type('Italic text');
      await page.keyboard.press('Meta+a');

      // Apply italic
      await page.keyboard.press('Meta+i');

      // Verify italic applied
      let emElement = editor.locator('em');
      await expect(emElement).toContainText('Italic text');

      // Toggle italic off
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Meta+i');

      // Verify italic removed
      emElement = editor.locator('em');
      await expect(emElement).toHaveCount(0);
      await expect(editor).toContainText('Italic text');
    });

    test('should apply italic while typing (no selection)', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type normal, activate italic, type italic, deactivate, type normal
      await page.keyboard.type('Normal ');
      await page.keyboard.press('Meta+i');
      await page.keyboard.type('italic');
      await page.keyboard.press('Meta+i');
      await page.keyboard.type(' normal');

      // Verify structure
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();

      expect(html).toMatch(/Normal <em>italic<\/em> normal/);
    });
  });

  /**
   * Test Group 3: Combined Bold and Italic
   */
  test.describe('Combined Bold + Italic', () => {
    test('should apply both bold and italic to same text', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type text
      await page.keyboard.type('Important');

      // Select all
      await page.keyboard.press('Meta+a');

      // Apply bold
      await page.keyboard.press('Meta+b');

      // Apply italic (selection should still be active)
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Meta+i');

      // Verify both <strong> and <em> exist
      const strongElement = editor.locator('strong');
      const emElement = editor.locator('em');

      await expect(strongElement).toBeVisible();
      await expect(emElement).toBeVisible();

      // Verify nested structure (strong containing em, or em containing strong)
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();

      // TipTap may nest tags in either order
      const hasNestedFormatting =
        html.includes('<strong><em>Important</em></strong>') ||
        html.includes('<em><strong>Important</strong></em>');

      expect(hasNestedFormatting).toBe(true);
    });

    test('should toggle bold and italic independently', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type text with bold
      await page.keyboard.press('Meta+b');
      await page.keyboard.type('Bold');
      await page.keyboard.press('Meta+b');
      await page.keyboard.type(' ');

      // Type text with italic
      await page.keyboard.press('Meta+i');
      await page.keyboard.type('Italic');
      await page.keyboard.press('Meta+i');
      await page.keyboard.type(' ');

      // Type text with both
      await page.keyboard.press('Meta+b');
      await page.keyboard.press('Meta+i');
      await page.keyboard.type('Both');

      // Verify structure
      const paragraph = editor.locator('p');
      const html = await paragraph.innerHTML();

      expect(html).toContain('<strong>Bold</strong>');
      expect(html).toContain('<em>Italic</em>');
      expect(html).toMatch(/<(strong|em)><(em|strong)>Both<\/(em|strong)><\/(strong|em)>/);
    });
  });

  /**
   * Test Group 4: Formatting Across Paragraphs
   */
  test.describe('Multi-Paragraph Formatting', () => {
    test('should apply formatting only to selected paragraph', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type two paragraphs
      await page.keyboard.type('First paragraph');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Second paragraph');

      // Go back to first paragraph and select it
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Meta+a'); // This selects all in current block

      // Apply bold
      await page.keyboard.press('Meta+b');

      // Verify only first paragraph is bold
      const paragraphs = editor.locator('p');
      await expect(paragraphs).toHaveCount(2);

      const firstParagraph = paragraphs.nth(0);
      const firstHtml = await firstParagraph.innerHTML();
      expect(firstHtml).toContain('<strong>First paragraph</strong>');

      const secondParagraph = paragraphs.nth(1);
      const secondHtml = await secondParagraph.innerHTML();
      expect(secondHtml).not.toContain('<strong>');
      expect(secondHtml).toContain('Second paragraph');
    });
  });

  /**
   * Test Group 5: Formatting Edge Cases
   */
  test.describe('Edge Cases', () => {
    test('should handle formatting with special characters', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Type text with special chars
      await page.keyboard.type('Hello, "World"!');

      // Select and bold
      await page.keyboard.press('Meta+a');
      await page.keyboard.press('Meta+b');

      // Verify special characters preserved
      const strongElement = editor.locator('strong');
      await expect(strongElement).toContainText('Hello, "World"!');
    });

    test('should preserve formatting when adding text', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      // Create bold text
      await page.keyboard.press('Meta+b');
      await page.keyboard.type('Bold');
      await page.keyboard.press('Meta+b');

      // Move cursor back into bold text
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');

      // Type more (should be bold)
      await page.keyboard.type('er ');

      // Verify "Bolder" is all bold
      const strongElement = editor.locator('strong');
      await expect(strongElement).toContainText('Bolder');
    });

    test('should handle rapid format toggling', async ({ page }) => {
      await page.goto('/compose');

      const editor = page.getByRole('textbox');
      await editor.click();

      await page.keyboard.type('Test');
      await page.keyboard.press('Meta+a');

      // Rapidly toggle bold multiple times
      await page.keyboard.press('Meta+b');
      await page.keyboard.press('Meta+b');
      await page.keyboard.press('Meta+b');

      // Final state should be bold (odd number of toggles)
      const strongElement = editor.locator('strong');
      await expect(strongElement).toContainText('Test');
    });
  });
});
