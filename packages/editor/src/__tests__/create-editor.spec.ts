import { describe, expect, it, vi } from 'vitest';

import { createEditor } from '../editor';
import { getAppearanceSettings } from '../extensions';

describe('createEditor appearance seeding', () => {
  it('seeds appearance when no consumer onCreate is provided', () => {
    const editor = createEditor({
      appearance: { fontSize: 20 }
    });

    expect(getAppearanceSettings(editor).fontSize).toBe(20);

    editor.destroy();
  });

  it('chains built-in appearance seeding before consumer onCreate', () => {
    const consumerOnCreate = vi.fn(({ editor }) => {
      expect(getAppearanceSettings(editor).fontSize).toBe(20);
    });

    const editor = createEditor({
      appearance: { fontSize: 20 },
      editorOptions: {
        onCreate: consumerOnCreate
      }
    });

    expect(consumerOnCreate).toHaveBeenCalledTimes(1);

    editor.destroy();
  });
});
