import type { ComponentType } from 'react';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Editor } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDraft, saveDraft } from '../lib/drafts';

vi.mock('../lib/drafts', () => ({
  saveDraft: vi.fn(async () => undefined),
  loadDraft: vi.fn(async () => null),
}));

const saveDraftMock = vi.mocked(saveDraft);
const loadDraftMock = vi.mocked(loadDraft);

const COMPOSE_PATH = '../app/(editor)/compose/page';
const MISSING_MESSAGE =
  "Compose page not found at apps/web/app/(editor)/compose/page.tsx — please add the file before enabling toolbar/autosave tests.";

type ComposeModule = {
  default?: ComponentType;
  ComposePage?: ComponentType;
};

const loadCompose = async (): Promise<ComposeModule> => {
  try {
    return await import(COMPOSE_PATH);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ERR_MODULE_NOT_FOUND' || err?.message?.includes('Cannot find module')) {
      throw new Error(MISSING_MESSAGE);
    }
    throw error;
  }
};

const withCompose = (testName: string, fn: (module: ComposeModule) => Promise<void>) => {
  it(testName, async () => {
    const mod = await loadCompose();
    await fn(mod);
  });
};

const renderCompose = (mod: ComposeModule) => {
  const Compose = mod.default ?? mod.ComposePage;
  if (!Compose) {
    throw new Error('Compose page default export missing.');
  }
  return render(<Compose />);
};

const getEditorHandle = (): Editor => {
  const editor = (window as Record<string, unknown>).__composeEditor as Editor | undefined;
  if (!editor) {
    throw new Error('Compose editor handle not found on window.');
  }
  return editor;
};

const selectAll = (element: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const docText = (node: unknown): string => {
  if (!node) {
    return '';
  }
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(docText).join('');
  }
  if (typeof node === 'object') {
    const typedNode = node as { text?: string; content?: unknown };
    if (typedNode.text) {
      return typedNode.text;
    }
    if (typedNode.content) {
      return docText(typedNode.content);
    }
  }
  return '';
};

beforeEach(() => {
  loadDraftMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  const handle = window as Record<string, unknown>;
  if ('__composeEditor' in handle) {
    delete handle.__composeEditor;
  }
});

describe('compose page presence', () => {
  it('exists at apps/web/app/(editor)/compose/page.tsx', async () => {
    await loadCompose();
  });
});

withCompose("toolbar › bold button applies 'strong' mark to selection", async (mod) => {
  const user = userEvent.setup();
  renderCompose(mod);
  const editorEl = await screen.findByTestId('editor-root');
  await user.click(editorEl);
  selectAll(editorEl);
  const boldButton = screen.getByRole('button', { name: /bold/i });
  await user.click(boldButton);
  await waitFor(() => expect(boldButton).toHaveAttribute('aria-pressed', 'true'));
  const doc = getEditorHandle().getJSON();
  const firstNode = doc.content?.[0];
  const marks = firstNode?.content?.[0]?.marks ?? [];
  expect(
    Array.isArray(marks) && marks.some((mark: { type?: string }) => (mark?.type ?? '').toLowerCase() === 'bold'),
  ).toBe(true);
  expect(editorEl.innerHTML.toLowerCase()).toContain('<strong');
});

withCompose('toolbar › H1 button converts paragraph to heading level 1', async (mod) => {
  const user = userEvent.setup();
  renderCompose(mod);
  const editorEl = await screen.findByTestId('editor-root');
  await user.click(editorEl);
  selectAll(editorEl);
  await user.type(editorEl, 'Title');
  const headingButton = screen.getByRole('button', { name: /heading 1|h1/i });
  await user.click(headingButton);
  await waitFor(() => expect(headingButton).toHaveAttribute('aria-pressed', 'true'));
  const doc = getEditorHandle().getJSON();
  const firstNode = doc.content?.[0];
  expect(firstNode?.type).toBe('heading');
  expect(firstNode?.attrs?.level).toBe(1);
  expect(editorEl.innerHTML.toLowerCase()).toContain('<h1');
});

withCompose('autosave › fires once with latest content across rapid edits', async (mod) => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  loadDraftMock.mockResolvedValueOnce({
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello' }],
        },
      ],
    },
  });
  renderCompose(mod);
  const editorEl = await screen.findByTestId('editor-root');
  await user.click(editorEl);
  await user.type(editorEl, 'A');
  vi.advanceTimersByTime(400);
  await user.type(editorEl, 'B');
  vi.advanceTimersByTime(500);
  await vi.runOnlyPendingTimersAsync();
  expect(saveDraftMock).toHaveBeenCalledTimes(1);
  const payload = saveDraftMock.mock.calls[0]?.[0] ?? {};
  expect(docText((payload as { content?: unknown }).content)).toBe('HelloAB');
});
