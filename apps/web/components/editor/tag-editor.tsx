/**
 * TagEditor Component (T041)
 *
 * UI component for editing article tags with auto-suggestions
 * Located at: apps/web/components/editor/tag-editor.tsx
 *
 * Requirements:
 * - FR-003: System MUST auto-suggest editable/removable tags derived from article content
 * - Data model: tags (text[]) - Auto-suggested list editable by user; min 1 before publish
 * - Support adding, removing, and editing tags
 * - Display suggested tags from API
 * - Indicate loading state
 *
 * Technical decisions:
 * - Case-insensitive tag deduplication
 * - Whitespace trimming
 * - Keyboard-first interaction (Enter to add)
 * - Visual distinction between added and suggested tags
 * - Min/max validation
 */

'use client';

import React, { useState, useCallback, KeyboardEvent } from 'react';

export interface TagEditorProps {
  /**
   * Current list of tags
   */
  tags: string[];

  /**
   * Suggested tags from API (optional)
   */
  suggestedTags?: string[];

  /**
   * Whether suggestions are currently loading
   */
  isLoadingSuggestions?: boolean;

  /**
   * Callback triggered when tags change
   */
  onChange: (tags: string[]) => void;

  /**
   * Callback to request tag suggestions (optional)
   */
  onRequestSuggestions?: () => void;

  /**
   * Minimum number of tags required (default: 0)
   */
  minTags?: number;

  /**
   * Maximum number of tags allowed (default: undefined = unlimited)
   */
  maxTags?: number;

  /**
   * Additional CSS class name
   */
  className?: string;
}

/**
 * TagEditor component for managing article tags
 *
 * Features:
 * - Add tags via input + Enter or Add button
 * - Remove tags with remove button
 * - Display and add suggested tags
 * - Min/max validation
 * - Case-insensitive duplicate detection
 * - Whitespace trimming
 * - Keyboard accessible
 *
 * @example
 * ```tsx
 * <TagEditor
 *   tags={['react', 'typescript']}
 *   suggestedTags={['nodejs', 'javascript']}
 *   onChange={(newTags) => setTags(newTags)}
 *   onRequestSuggestions={() => fetchSuggestions()}
 *   isLoadingSuggestions={loading}
 *   minTags={1}
 *   maxTags={5}
 * />
 * ```
 */
const TagEditor: React.FC<TagEditorProps> = ({
  tags,
  suggestedTags = [],
  isLoadingSuggestions = false,
  onChange,
  onRequestSuggestions,
  minTags = 0,
  maxTags,
  className
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showMaxError, setShowMaxError] = useState(false);

  // Normalize tag for comparison (lowercase, trimmed)
  const normalizeTag = (tag: string): string => tag.trim().toLowerCase();

  // Check if tag already exists (case-insensitive)
  const tagExists = useCallback(
    (tag: string): boolean => {
      const normalized = normalizeTag(tag);
      return tags.some((t) => normalizeTag(t) === normalized);
    },
    [tags]
  );

  // Add a tag
  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();

      // Validate tag
      if (!trimmed) {
        return; // Empty tag
      }

      if (tagExists(trimmed)) {
        return; // Duplicate tag
      }

      if (maxTags !== undefined && tags.length >= maxTags) {
        setShowMaxError(true);
        setTimeout(() => setShowMaxError(false), 3000);
        return; // Max tags reached
      }

      // Add tag
      try {
        onChange([...tags, trimmed]);
        setInputValue('');
        setShowMaxError(false);
      } catch (error) {
        console.error('Error in onChange handler:', error);
      }
    },
    [tags, tagExists, maxTags, onChange]
  );

  // Remove a tag
  const removeTag = useCallback(
    (indexToRemove: number) => {
      try {
        const newTags = tags.filter((_, index) => index !== indexToRemove);
        onChange(newTags);
      } catch (error) {
        console.error('Error in onChange handler:', error);
      }
    },
    [tags, onChange]
  );

  // Handle input key press
  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag(inputValue);
    }
  };

  // Handle add button click
  const handleAddClick = () => {
    addTag(inputValue);
  };

  // Handle suggested tag click
  const handleSuggestedTagClick = (tag: string) => {
    addTag(tag);
  };

  // Handle request suggestions
  const handleRequestSuggestions = () => {
    if (onRequestSuggestions) {
      try {
        onRequestSuggestions();
      } catch (error) {
        console.error('Error in onRequestSuggestions handler:', error);
      }
    }
  };

  // Filter out already-added tags from suggestions
  const filteredSuggestions = suggestedTags.filter((tag) => !tagExists(tag));

  // Check if at max tags
  const atMaxTags = maxTags !== undefined && tags.length >= maxTags;

  // Check if below min tags
  const belowMinTags = tags.length < minTags;

  return (
    <div
      className={className}
      style={{
        padding: '1rem',
        backgroundColor: '#f9fafb',
        borderRadius: '8px',
        border: '1px solid #e5e7eb'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label
            htmlFor="tag-input"
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#374151'
            }}
          >
            Tags {tags.length > 0 && <span style={{ color: '#6b7280' }}>({tags.length})</span>}
          </label>
          {onRequestSuggestions && (
            <button
              type="button"
              onClick={handleRequestSuggestions}
              disabled={isLoadingSuggestions}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: isLoadingSuggestions ? 'not-allowed' : 'pointer',
                opacity: isLoadingSuggestions ? 0.6 : 1
              }}
            >
              {isLoadingSuggestions ? 'Loading...' : 'Suggest Tags'}
            </button>
          )}
        </div>
      </div>

      {/* Current Tags */}
      {tags.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {tags.map((tag, index) => (
              <div
                key={`${tag}-${index}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  borderRadius: '4px'
                }}
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  aria-label={`Remove ${tag}`}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '1rem',
                    lineHeight: '1',
                    fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Tag Input */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="tag-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Add a tag..."
            aria-label="Add tag"
            disabled={atMaxTags}
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              opacity: atMaxTags ? 0.6 : 1,
              cursor: atMaxTags ? 'not-allowed' : 'text'
            }}
          />
          <button
            type="button"
            onClick={handleAddClick}
            disabled={!inputValue.trim() || atMaxTags}
            aria-label="Add"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '4px',
              cursor: !inputValue.trim() || atMaxTags ? 'not-allowed' : 'pointer',
              opacity: !inputValue.trim() || atMaxTags ? 0.6 : 1
            }}
          >
            Add
          </button>
        </div>
      </div>

      {/* Validation Messages */}
      {belowMinTags && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            fontSize: '0.75rem',
            color: '#dc2626',
            backgroundColor: '#fee2e2',
            borderRadius: '4px'
          }}
        >
          At least {minTags} tag{minTags !== 1 ? 's' : ''} required
        </div>
      )}

      {showMaxError && maxTags && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            fontSize: '0.75rem',
            color: '#dc2626',
            backgroundColor: '#fee2e2',
            borderRadius: '4px'
          }}
        >
          Maximum {maxTags} tags allowed
        </div>
      )}

      {/* Loading Suggestions */}
      {isLoadingSuggestions && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.5rem',
            fontSize: '0.75rem',
            color: '#6b7280',
            fontStyle: 'italic'
          }}
        >
          Loading suggestions...
        </div>
      )}

      {/* Suggested Tags */}
      {filteredSuggestions.length > 0 && !isLoadingSuggestions && (
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: '#6b7280',
              marginBottom: '0.5rem'
            }}
          >
            Suggested:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {filteredSuggestions.map((tag, index) => (
              <button
                key={`suggested-${tag}-${index}`}
                type="button"
                onClick={() => handleSuggestedTagClick(tag)}
                disabled={atMaxTags}
                aria-label={tag}
                style={{
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.875rem',
                  color: '#374151',
                  backgroundColor: '#ffffff',
                  border: '1px dashed #d1d5db',
                  borderRadius: '4px',
                  cursor: atMaxTags ? 'not-allowed' : 'pointer',
                  opacity: atMaxTags ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!atMaxTags) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.color = '#3b82f6';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.color = '#374151';
                }}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TagEditor;
