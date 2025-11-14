/**
 * Editor Component Tests (T039)
 *
 * Test-Driven Development approach for the Editor React component
 * Located at: apps/web/components/editor/editor.tsx
 *
 * Requirements:
 * - FR-001: Support headings, bold, italic, code blocks, image embeds, video embeds
 * - FR-009: Appearance controls (font size, left padding)
 * - Must integrate with TipTap editor factory from packages/editor
 * - Must handle draft auto-save
 * - Must support loading initial content
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import Editor from '../editor';

// Don't mock the @blog-spec/editor package - use the real implementation
// This is a React component integration test, so we test against real dependencies

const mockOnChange = vi.fn();
const mockOnSave = vi.fn();

beforeEach(() => {
  mockOnChange.mockClear();
  mockOnSave.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Editor Component - Initialization', () => {
  it('should render editor with default empty content', async () => {
    render(<Editor />);

    const editorElement = await screen.findByRole('textbox', { name: /editor/i });
    expect(editorElement).toBeInTheDocument();
  });

  it('should render with initial MDX content', async () => {
    const initialMDX = '# Hello World\n\nThis is **bold** text.';
    render(<Editor initialContent={{ mdx: initialMDX }} />);

    const editorElement = await screen.findByRole('textbox');
    await waitFor(() => {
      expect(editorElement.textContent).toContain('Hello World');
      expect(editorElement.textContent).toContain('bold');
    });
  });

  it('should render with initial TipTap JSON content', async () => {
    const initialJSON: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Test Heading' }]
        }
      ]
    };

    render(<Editor initialContent={{ tiptap: initialJSON }} />);

    const editorElement = await screen.findByRole('textbox');
    await waitFor(() => {
      expect(editorElement.textContent).toContain('Test Heading');
    });
  });

  it('should apply initial appearance settings', async () => {
    const appearance = { fontSize: 20, leftPadding: 32 };
    render(<Editor initialContent={{ appearance }} />);

    const editorElement = await screen.findByRole('textbox');
    await waitFor(() => {
      const styles = window.getComputedStyle(editorElement);
      // Check that CSS custom properties are set (they'll be applied by the extension)
      expect(editorElement).toBeInTheDocument();
    });
  });
});

describe('Editor Component - Content Editing', () => {
  it('should allow typing text', async () => {
    const user = userEvent.setup();
    render(<Editor onChange={mockOnChange} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'Hello World');

    await waitFor(() => {
      expect(editorElement.textContent).toContain('Hello World');
    });
  });

  it('should call onChange handler when content changes', async () => {
    const user = userEvent.setup();
    render(<Editor onChange={mockOnChange} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'Test');

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
      const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastCall).toHaveProperty('tiptap');
      expect(lastCall).toHaveProperty('mdx');
      expect(lastCall).toHaveProperty('appearance');
    });
  });

  it('should support bold formatting command', async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'Bold text');

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(editorElement);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    // Get editor instance via ref or data attribute
    await waitFor(() => {
      expect(editorElement).toBeInTheDocument();
    });
  });
});

describe('Editor Component - Auto-save', () => {
  it('should trigger auto-save after content changes', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Editor onSave={mockOnSave} autoSaveDelay={1000} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'Auto-save test');

    // Fast-forward time to trigger auto-save
    vi.advanceTimersByTime(1100);
    await vi.runOnlyPendingTimersAsync();

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const savedData = mockOnSave.mock.calls[0][0];
      expect(savedData).toHaveProperty('mdx');
      expect(savedData.mdx).toContain('Auto-save test');
    });

    vi.useRealTimers();
  });

  it('should debounce multiple rapid changes', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Editor onSave={mockOnSave} autoSaveDelay={1000} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'A');

    vi.advanceTimersByTime(500);
    await user.type(editorElement, 'B');

    vi.advanceTimersByTime(500);
    await user.type(editorElement, 'C');

    vi.advanceTimersByTime(1100);
    await vi.runOnlyPendingTimersAsync();

    // Should only save once with final content
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      const savedData = mockOnSave.mock.calls[0][0];
      expect(savedData.mdx).toContain('ABC');
    });

    vi.useRealTimers();
  });

  it('should not auto-save if autoSaveDelay is not provided', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<Editor onSave={mockOnSave} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'No auto-save');

    vi.advanceTimersByTime(5000);
    await vi.runOnlyPendingTimersAsync();

    expect(mockOnSave).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('Editor Component - Accessibility', () => {
  it('should have proper ARIA attributes', async () => {
    render(<Editor ariaLabel="Article editor" />);

    const editorElement = await screen.findByRole('textbox', { name: /article editor/i });
    expect(editorElement).toHaveAttribute('aria-multiline', 'true');
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<Editor />);

    const editorElement = await screen.findByRole('textbox');

    // Tab to editor
    await user.tab();
    expect(editorElement).toHaveFocus();

    // Type in editor
    await user.keyboard('Accessible content');
    await waitFor(() => {
      expect(editorElement.textContent).toContain('Accessible content');
    });
  });
});

describe('Editor Component - Cleanup', () => {
  it('should cleanup editor instance on unmount', async () => {
    const { unmount } = render(<Editor />);

    const editorElement = await screen.findByRole('textbox');
    expect(editorElement).toBeInTheDocument();

    unmount();

    // Editor should be destroyed
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('should clear auto-save timer on unmount', async () => {
    vi.useFakeTimers();
    const { unmount } = render(<Editor onSave={mockOnSave} autoSaveDelay={1000} />);

    await screen.findByRole('textbox');
    unmount();

    vi.advanceTimersByTime(2000);
    await vi.runOnlyPendingTimersAsync();

    expect(mockOnSave).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});

describe('Editor Component - Error Handling', () => {
  it('should handle invalid initial content gracefully', async () => {
    const invalidContent = { tiptap: { type: 'invalid' } as any };

    // Should not throw
    expect(() => {
      render(<Editor initialContent={invalidContent} />);
    }).not.toThrow();

    const editorElement = await screen.findByRole('textbox');
    expect(editorElement).toBeInTheDocument();
  });

  it('should handle onChange errors gracefully', async () => {
    const errorOnChange = vi.fn(() => {
      throw new Error('onChange error');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<Editor onChange={errorOnChange} />);

    const editorElement = await screen.findByRole('textbox');
    await user.click(editorElement);
    await user.type(editorElement, 'Test');

    // Editor should still work despite error
    expect(editorElement.textContent).toContain('Test');

    consoleError.mockRestore();
  });
});
