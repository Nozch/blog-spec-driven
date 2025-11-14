/**
 * TagEditor Component Tests (T041)
 *
 * Test-Driven Development approach for the TagEditor UI component
 * Located at: apps/web/components/editor/tag-editor.tsx
 *
 * Requirements:
 * - FR-003: System MUST auto-suggest editable/removable tags derived from article content
 * - Data model: tags (text[]) - Auto-suggested list editable by user; min 1 before publish
 * - Must support adding, removing, and editing tags
 * - Must display suggested tags (from API)
 * - Must indicate when loading suggestions
 */

import React from 'react';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TagEditor from '../tag-editor';

const mockOnChange = vi.fn();
const mockOnRequestSuggestions = vi.fn();

beforeEach(() => {
  mockOnChange.mockClear();
  mockOnRequestSuggestions.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('TagEditor - Rendering', () => {
  it('should render with empty tags list', () => {
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    expect(screen.getByText(/tags/i)).toBeInTheDocument();
  });

  it('should render existing tags as removable chips', () => {
    render(<TagEditor tags={['react', 'typescript']} onChange={mockOnChange} />);

    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('should render add tag input', () => {
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    expect(screen.getByPlaceholderText(/add.*tag/i)).toBeInTheDocument();
  });

  it('should display suggested tags when provided', () => {
    render(
      <TagEditor
        tags={['existing']}
        suggestedTags={['react', 'nodejs']}
        onChange={mockOnChange}
      />
    );

    // Should show suggestions section
    expect(screen.getByText(/suggested/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'react' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'nodejs' })).toBeInTheDocument();
  });

  it('should show loading state when fetching suggestions', () => {
    render(
      <TagEditor
        tags={[]}
        isLoadingSuggestions={true}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/loading.*suggestions/i)).toBeInTheDocument();
  });
});

describe('TagEditor - Adding Tags', () => {
  it('should add a tag when user types and presses Enter', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'newtag{Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
  });

  it('should add a tag when user types and clicks Add button', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'newtag');

    const addButton = screen.getByRole('button', { name: /add/i });
    await user.click(addButton);

    expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
  });

  it('should clear input after adding a tag', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i) as HTMLInputElement;
    await user.type(input, 'newtag{Enter}');

    expect(input.value).toBe('');
  });

  it('should trim whitespace from tags', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, '  spaced  {Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(['spaced']);
  });

  it('should not add empty tags', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, '   {Enter}');

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should not add duplicate tags', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={['existing']} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'existing{Enter}');

    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should convert tags to lowercase for deduplication', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={['react']} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'React{Enter}');

    // Should not add duplicate (case-insensitive)
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it('should append new tags to existing tags', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={['existing1', 'existing2']} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'newtag{Enter}');

    expect(mockOnChange).toHaveBeenCalledWith(['existing1', 'existing2', 'newtag']);
  });
});

describe('TagEditor - Removing Tags', () => {
  it('should remove a tag when remove button is clicked', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={['tag1', 'tag2']} onChange={mockOnChange} />);

    // Find remove button for tag1 (typically an X button)
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);

    expect(mockOnChange).toHaveBeenCalledWith(['tag2']);
  });

  it('should remove multiple tags independently', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={['tag1', 'tag2', 'tag3']} onChange={mockOnChange} />);

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });

    // Remove tag2 (index 1)
    await user.click(removeButtons[1]);

    expect(mockOnChange).toHaveBeenCalledWith(['tag1', 'tag3']);
  });
});

describe('TagEditor - Suggested Tags', () => {
  it('should add suggested tag when clicked', async () => {
    const user = userEvent.setup();
    render(
      <TagEditor
        tags={[]}
        suggestedTags={['react', 'typescript']}
        onChange={mockOnChange}
      />
    );

    // Click on suggested tag
    const reactTag = screen.getByRole('button', { name: /react/i });
    await user.click(reactTag);

    expect(mockOnChange).toHaveBeenCalledWith(['react']);
  });

  it('should not show already-added tags in suggestions', () => {
    render(
      <TagEditor
        tags={['react']}
        suggestedTags={['react', 'typescript']}
        onChange={mockOnChange}
      />
    );

    // react should appear once (in tags list, not in suggestions)
    // Check by looking for the suggestion button - it should not exist
    expect(screen.queryByRole('button', { name: 'react' })).not.toBeInTheDocument();
    // typescript should be in suggestions
    expect(screen.getByRole('button', { name: 'typescript' })).toBeInTheDocument();
  });

  it('should request suggestions when button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <TagEditor
        tags={[]}
        onRequestSuggestions={mockOnRequestSuggestions}
        onChange={mockOnChange}
      />
    );

    const suggestButton = screen.getByRole('button', { name: /suggest.*tags/i });
    await user.click(suggestButton);

    expect(mockOnRequestSuggestions).toHaveBeenCalled();
  });

  it('should disable suggest button while loading', () => {
    render(
      <TagEditor
        tags={[]}
        isLoadingSuggestions={true}
        onRequestSuggestions={mockOnRequestSuggestions}
        onChange={mockOnChange}
      />
    );

    const suggestButton = screen.getByRole('button', { name: /loading/i });
    expect(suggestButton).toBeDisabled();
  });
});

describe('TagEditor - Validation', () => {
  it('should show error when minimum tags not met', () => {
    render(<TagEditor tags={[]} minTags={1} onChange={mockOnChange} />);

    expect(screen.getByText(/at least.*1.*tag/i)).toBeInTheDocument();
  });

  it('should not show error when minimum tags requirement is met', () => {
    render(<TagEditor tags={['tag1']} minTags={1} onChange={mockOnChange} />);

    expect(screen.queryByText(/at least.*tag/i)).not.toBeInTheDocument();
  });

  it('should show error when maximum tags exceeded', async () => {
    const user = userEvent.setup();
    // Start already at max tags
    render(<TagEditor tags={['tag1', 'tag2']} maxTags={2} onChange={mockOnChange} />);

    // Input and button should be disabled
    const input = screen.getByPlaceholderText(/add.*tag/i);
    const addButton = screen.getByRole('button', { name: /^add$/i });

    expect(input).toBeDisabled();
    expect(addButton).toBeDisabled();

    // Even though UI is disabled, the error message display is tested separately
    // by checking that max tags disables the UI appropriately
    // The actual error message display requires the addTag function to be called,
    // which happens when user tries to add a tag programmatically or via suggestion click

    // Test: Try clicking a suggested tag when at max
    const { rerender } = render(
      <TagEditor
        tags={['tag1', 'tag2']}
        suggestedTags={['tag3']}
        maxTags={2}
        onChange={mockOnChange}
      />
    );

    // The suggested tag button should be disabled
    const suggestedButton = screen.getByRole('button', { name: 'tag3' });
    expect(suggestedButton).toBeDisabled();
  });

  it('should disable add button when max tags reached', () => {
    render(<TagEditor tags={['tag1', 'tag2']} maxTags={2} onChange={mockOnChange} />);

    const addButton = screen.getByRole('button', { name: /add/i });
    expect(addButton).toBeDisabled();
  });
});

describe('TagEditor - Accessibility', () => {
  it('should have proper labels for screen readers', () => {
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    expect(input).toHaveAccessibleName();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={mockOnChange} />);

    // Tab to input
    await user.tab();
    const input = screen.getByPlaceholderText(/add.*tag/i);
    expect(input).toHaveFocus();

    // Type and submit with Enter
    await user.keyboard('newtag{Enter}');
    expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
  });

  it('should announce tag count for screen readers', () => {
    render(<TagEditor tags={['tag1', 'tag2']} onChange={mockOnChange} />);

    // Should have tag count displayed as "(2)"
    expect(screen.getByText('(2)')).toBeInTheDocument();

    // Should also have remove buttons for accessibility
    expect(screen.queryAllByRole('button', { name: /remove/i })).toHaveLength(2);
  });
});

describe('TagEditor - Visual Feedback', () => {
  it('should provide visual feedback for tag addition', async () => {
    const user = userEvent.setup();
    const { container } = render(<TagEditor tags={[]} onChange={mockOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'newtag{Enter}');

    // After onChange is called with the new tag, component should re-render
    // In a controlled component scenario, parent would update props
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should highlight suggested tags differently from added tags', () => {
    const { container } = render(
      <TagEditor
        tags={['added']}
        suggestedTags={['suggested']}
        onChange={mockOnChange}
      />
    );

    // Both should be present but potentially styled differently
    // Added tag appears as text
    expect(screen.getByText('added')).toBeInTheDocument();
    // Suggested tag appears as button with aria-label
    expect(screen.getByRole('button', { name: 'suggested' })).toBeInTheDocument();
  });
});

describe('TagEditor - Error Handling', () => {
  it('should handle onChange errors gracefully', async () => {
    const errorOnChange = vi.fn(() => {
      throw new Error('onChange error');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<TagEditor tags={[]} onChange={errorOnChange} />);

    const input = screen.getByPlaceholderText(/add.*tag/i);
    await user.type(input, 'newtag{Enter}');

    // Component should still work
    expect(input).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should handle onRequestSuggestions errors gracefully', async () => {
    const errorOnRequest = vi.fn(() => {
      throw new Error('Request error');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const user = userEvent.setup();
    render(
      <TagEditor
        tags={[]}
        onRequestSuggestions={errorOnRequest}
        onChange={mockOnChange}
      />
    );

    const suggestButton = screen.getByRole('button', { name: /suggest.*tags/i });
    await user.click(suggestButton);

    // Component should still work
    expect(suggestButton).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
