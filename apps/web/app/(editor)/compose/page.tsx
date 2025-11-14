/**
 * Compose Page
 *
 * Page for composing new blog articles using the Editor component (T039)
 *
 * Requirements:
 * - FR-001: Provide in-browser editing with formatting controls
 * - FR-009: Support appearance customization
 * - Support draft auto-save
 */

'use client';

import { useState, useCallback } from 'react';
import Editor from '../../../components/editor/editor';
import type { EditorSerializedState } from '@blog-spec/editor';
import { loadDraft, saveDraft } from '../../../src/lib/drafts';

const ComposePage = () => {
  const [isSaving, setIsSaving] = useState(false);

  // Handle auto-save
  const handleSave = useCallback(async (state: EditorSerializedState) => {
    setIsSaving(true);
    try {
      await saveDraft({
        content: state.tiptap,
        mdx: state.mdx,
        appearance: state.appearance
      });
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Compose Article</h1>
        {isSaving && (
          <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Saving...
          </span>
        )}
      </div>

      <Editor
        onSave={handleSave}
        autoSaveDelay={1000}
        ariaLabel="Compose editor"
        autoFocus
      />
    </div>
  );
};

export default ComposePage;
