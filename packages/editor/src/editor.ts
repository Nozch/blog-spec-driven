import { Editor, type EditorOptions, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {
  DEFAULT_APPEARANCE,
  type AppearanceSettings,
  createExtensionKit,
  getAppearanceSettings
} from './extensions';
import { serializeTipTapToMDX } from './serializers/mdx-serializer';
import { parseMDXToTipTap } from './parsers/mdx-parser';

export interface CreateEditorOptions {
  /**
   * Optional DOM element to mount the editor on (used by @tiptap/react under the hood).
   */
  element?: HTMLElement;
  /**
   * Initial TipTap JSON document. Takes precedence over mdx if both are provided.
   */
  tiptap?: JSONContent;
  /**
   * MDX string to hydrate into TipTap JSON when no tiptap content is passed.
   */
  mdx?: string;
  /**
   * Optional appearance overrides to seed the appearance extension store.
   */
  appearance?: AppearanceSettings;
  /**
   * Additional TipTap editor options (onUpdate handlers, autofocus, etc.).
   */
  editorOptions?: Partial<EditorOptions>;
}

export interface EditorSerializedState {
  tiptap: JSONContent;
  mdx: string;
  appearance: AppearanceSettings;
}

export const createEditor = (options: CreateEditorOptions = {}): Editor => {
  const initialContent = options.tiptap ?? (options.mdx ? mdxToJSON(options.mdx) : undefined);
  const editorOptions = options.editorOptions ?? {};
  const userOnCreate = editorOptions.onCreate;
  let hasSeededAppearance = false;

  const runAppearanceSeeding = (ctx: { editor: Editor }) => {
    if (hasSeededAppearance) {
      return;
    }
    hasSeededAppearance = true;
    if (options.appearance) {
      ctx.editor.commands.setAppearance(options.appearance);
    }
    userOnCreate?.(ctx);
  };

  const editor = new Editor({
    element: options.element,
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
    content: initialContent,
    ...editorOptions,
    onCreate: runAppearanceSeeding
  });

  runAppearanceSeeding({ editor });

  return editor;
};

export const serializeEditorState = (editor: Editor): EditorSerializedState => {
  const json = editor.getJSON();
  return {
    tiptap: json,
    mdx: serializeTipTapToMDX(json),
    appearance: getAppearanceSettings(editor)
  };
};

export const mdxToJSON = (mdx: string): JSONContent => parseMDXToTipTap(mdx);

/**
 * @deprecated Use serializeTipTapToMDX from './serializers/mdx-serializer' instead
 */
export const jsonToMDX = (json: JSONContent): string => serializeTipTapToMDX(json);

export const buildEmptyState = (): JSONContent => ({
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '' }]
    }
  ]
});

export const mergeAppearance = (incoming?: AppearanceSettings): AppearanceSettings => ({
  fontSize: incoming?.fontSize ?? DEFAULT_APPEARANCE.fontSize,
  leftPadding: incoming?.leftPadding ?? DEFAULT_APPEARANCE.leftPadding
});
