/**
 * Editor Component (T039)
 *
 * A React wrapper for the TipTap editor with auto-save functionality
 * Located at: apps/web/components/editor/editor.tsx
 *
 * Requirements:
 * - FR-001: Support headings, bold, italic, code blocks, image embeds, video embeds
 * - FR-009: Appearance controls (font size, left padding)
 * - Integrate with TipTap editor factory from @blog-spec/editor
 * - Support draft auto-save with debouncing
 * - Handle initial content loading (MDX or TipTap JSON)
 * - Provide serialized state on change/save
 *
 * Technical decisions:
 * - Uses @tiptap/react for React integration
 * - Auto-save debounced using useEffect + setTimeout
 * - Exposes serialized state (tiptap, mdx, appearance) via callbacks
 * - Graceful error handling for onChange/onSave failures
 */

'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  createExtensionKit,
  serializeEditorState,
  mdxToJSON,
  type EditorSerializedState
} from '@blog-spec/editor';

export interface EditorProps {
  /**
   * Initial content for the editor
   */
  initialContent?: {
    /** TipTap JSON (takes precedence over mdx) */
    tiptap?: JSONContent;
    /** MDX string */
    mdx?: string;
    /** Appearance settings */
    appearance?: {
      fontSize?: number;
      leftPadding?: number;
    };
  };

  /**
   * Callback triggered on every content change
   * @param state - Serialized editor state
   */
  onChange?: (state: EditorSerializedState) => void;

  /**
   * Callback triggered for auto-save (debounced)
   * @param state - Serialized editor state
   */
  onSave?: (state: EditorSerializedState) => void;

  /**
   * Auto-save delay in milliseconds (default: disabled)
   * If not provided, auto-save is disabled
   */
  autoSaveDelay?: number;

  /**
   * ARIA label for accessibility
   */
  ariaLabel?: string;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Whether the editor should autofocus on mount
   */
  autoFocus?: boolean;
}

/**
 * Editor component for blog article composition
 *
 * Provides a rich-text editing experience with:
 * - Headings (H1-H4)
 * - Text formatting (bold, italic, inline code)
 * - Code blocks with syntax highlighting
 * - Image embeds with captions
 * - Video embeds with aspect ratios
 * - Appearance controls (font size, padding)
 * - Auto-save with debouncing
 *
 * @example
 * ```tsx
 * <Editor
 *   initialContent={{ mdx: "# Hello World" }}
 *   onChange={(state) => console.log('Changed:', state)}
 *   onSave={(state) => saveDraft(state)}
 *   autoSaveDelay={1000}
 *   ariaLabel="Article editor"
 * />
 * ```
 */
const Editor: React.FC<EditorProps> = ({
  initialContent,
  onChange,
  onSave,
  autoSaveDelay,
  ariaLabel = 'Editor',
  className,
  autoFocus = false
}) => {
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prepare initial content
  const initialContentJSON = useMemo(() => {
    if (initialContent?.tiptap) {
      return initialContent.tiptap;
    }
    if (initialContent?.mdx) {
      return mdxToJSON(initialContent.mdx);
    }
    return undefined;
  }, [initialContent?.tiptap, initialContent?.mdx]);

  // Create TipTap editor instance using @tiptap/react
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,   // Using custom HeadingExtension (T030)
        image: false,     // Using custom ImageFigure (T033)
        codeBlock: false, // Using custom CodeBlockExtension (T032)
        bold: false,      // Using custom TextStylesExtension for bold (T031)
        italic: false     // Using custom TextStylesExtension for italic (T031)
      }),
      ...createExtensionKit()
    ],
    content: initialContentJSON,
    onCreate({ editor: editorInstance }) {
      // Apply initial appearance settings if provided
      if (initialContent?.appearance) {
        editorInstance.commands.setAppearance(initialContent.appearance);
      }
    },
    onUpdate({ editor: editorInstance }) {
      try {
        const serialized = serializeEditorState(editorInstance);

        // Call onChange handler
        if (onChange) {
          try {
            onChange(serialized);
          } catch (error) {
            console.error('Error in onChange handler:', error);
          }
        }

        // Schedule auto-save if configured
        if (onSave && autoSaveDelay !== undefined && autoSaveDelay > 0) {
          // Clear existing timer
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }

          // Schedule new auto-save
          autoSaveTimerRef.current = setTimeout(() => {
            try {
              const currentState = serializeEditorState(editorInstance);
              onSave(currentState);
            } catch (error) {
              console.error('Error in onSave handler:', error);
            }
          }, autoSaveDelay);
        }
      } catch (error) {
        console.error('Error serializing editor state:', error);
      }
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': ariaLabel,
        'aria-multiline': 'true',
        'data-testid': 'editor-root',
        class: className ? `editor-content ${className}` : 'editor-content'
      }
    },
    autofocus: autoFocus ? 'end' : false
  });

  // Cleanup auto-save timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={className}
      style={{
        minHeight: '200px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '1rem'
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
};

export default Editor;
