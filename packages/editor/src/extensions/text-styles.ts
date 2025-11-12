/**
 * TextStyles Extension (T031)
 *
 * Provides bold and italic formatting that aligns with the Personal Blog
 * Publishing Flow requirements (FR-001). We disable StarterKit's marks, so
 * this module reintroduces commands via custom TipTap marks without bringing in
 * additional npm dependencies.
 */

import { Extension, Mark, mergeAttributes } from '@tiptap/core';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type TextStyleConfig = {
  name: 'bold' | 'italic';
  tag: 'strong' | 'em';
  shortcut: string;
};

const createTextStyleMark = (options: TextStyleConfig) =>
  Mark.create({
    name: options.name,

    parseHTML: () => [{ tag: options.tag }],

    renderHTML({ HTMLAttributes }) {
      return [options.tag, mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
      const capitalized = capitalize(options.name);
      return {
        [`set${capitalized}`]: () => ({ commands }) => commands.setMark(options.name),
        [`toggle${capitalized}`]: () => ({ commands }) => commands.toggleMark(options.name),
        [`unset${capitalized}`]: () => ({ commands }) => commands.unsetMark(options.name)
      };
    },

    addKeyboardShortcuts() {
      return {
        [options.shortcut]: () => this.editor.commands.toggleMark(options.name)
      };
    }
  });

const BoldMark = createTextStyleMark({
  name: 'bold',
  tag: 'strong',
  shortcut: 'Mod-b'
});

const ItalicMark = createTextStyleMark({
  name: 'italic',
  tag: 'em',
  shortcut: 'Mod-i'
});

export const TextStylesExtension = Extension.create({
  name: 'textStyles',
  addExtensions() {
    return [BoldMark, ItalicMark];
  }
});
