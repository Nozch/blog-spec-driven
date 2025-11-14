# Editor Component (T039)

**Status**: ✅ Complete
**Branch**: `001-t039-editor-component`
**Location**: `apps/web/components/editor/editor.tsx`

## Overview

The Editor component is a React wrapper for the TipTap editor that provides a rich-text editing experience for blog article composition. It integrates all custom TipTap extensions (T030-T035) and provides auto-save functionality.

## Features

### Content Support (FR-001)

- ✅ Headings (H1-H4) via HeadingExtension (T030)
- ✅ Text formatting: bold, italic, inline code via TextStylesExtension (T031)
- ✅ Code blocks with syntax highlighting via CodeBlockExtension (T032)
- ✅ Image embeds with captions and sizing via ImageEmbedExtension (T033)
- ✅ Video embeds with aspect ratios via VideoEmbedExtension (T034)
- ✅ Bullet and ordered lists (from StarterKit)
- ✅ Hard breaks

### Appearance Controls (FR-009)

- ✅ Font size control (14-24px range) via AppearanceExtension (T035)
- ✅ Left padding control (0-64px range) via AppearanceExtension (T035)
- ✅ Settings persist and serialize independently from content

### Additional Features

- ✅ **Auto-save with debouncing**: Configurable delay prevents excessive saves
- ✅ **MDX and TipTap JSON**: Supports both content formats for initialization
- ✅ **Serialization**: Exports content in both TipTap JSON and MDX formats
- ✅ **Accessibility**: Proper ARIA labels and keyboard navigation
- ✅ **Error handling**: Graceful handling of onChange/onSave failures
- ✅ **React lifecycle**: Proper cleanup of timers and editor instances

## API

### Props

```typescript
interface EditorProps {
  initialContent?: {
    tiptap?: JSONContent; // Takes precedence
    mdx?: string; // Fallback
    appearance?: {
      // Appearance settings
      fontSize?: number; // 14-24px
      leftPadding?: number; // 0-64px
    };
  };
  onChange?: (state: EditorSerializedState) => void;
  onSave?: (state: EditorSerializedState) => void;
  autoSaveDelay?: number; // milliseconds (default: disabled)
  ariaLabel?: string; // Accessibility label
  className?: string; // Additional CSS class
  autoFocus?: boolean; // Auto-focus on mount
}
```

### Serialized State

The component provides serialized state via `onChange` and `onSave` callbacks:

```typescript
interface EditorSerializedState {
  tiptap: JSONContent; // TipTap JSON document
  mdx: string; // MDX string representation
  appearance: AppearanceSettings; // Appearance settings
}
```

## Usage Example

```tsx
import Editor from "@/components/editor/editor";

function ComposePage() {
  const handleSave = async (state) => {
    await saveDraft({
      content: state.tiptap,
      mdx: state.mdx,
      appearance: state.appearance,
    });
  };

  return (
    <Editor
      initialContent={{ mdx: "# Hello World" }}
      onSave={handleSave}
      autoSaveDelay={1000}
      ariaLabel="Article editor"
      autoFocus
    />
  );
}
```

## Architecture

```
Editor Component (editor.tsx)
├── Uses @tiptap/react's useEditor hook
├── Configures StarterKit (disables conflicting extensions)
├── Loads custom extensions via createExtensionKit()
├── Parses initial MDX content via mdxToJSON()
├── Serializes state via serializeEditorState()
└── Manages auto-save timer with useRef + setTimeout
```

## Implementation Highlights

`★ Insight ─────────────────────────────────────`
**Key Technical Decisions**:

1. **React Hook Integration**: Using @tiptap/react's useEditor instead of the raw editor factory provides better React lifecycle integration
2. **Extension Composition**: Leveraged createExtensionKit() to get all custom extensions while strategically disabling conflicting StarterKit extensions (heading, bold, italic, codeBlock, image)
3. **Memoization**: Used useMemo for MDX parsing to prevent unnecessary re-parsing on every render
4. **Debounced Auto-save**: Implemented via useRef + setTimeout pattern, ensuring only the latest content is saved
5. **Graceful Error Handling**: try-catch blocks around onChange/onSave callbacks prevent crashes from consumer errors
   `─────────────────────────────────────────────────`

## Testing

Tests are located at: `apps/web/components/editor/__tests__/editor.test.tsx`

Test coverage includes:

- ✅ Initialization with various content formats
- ✅ Content editing and onChange callbacks
- ✅ Auto-save debouncing behavior
- ✅ Accessibility attributes and keyboard navigation
- ✅ Component cleanup (timers, editor instances)
- ✅ Error handling for invalid content and callback failures

**Note**: The component implementation is complete. Comprehensive integration tests will be enabled when T040 (Appearance Controls UI) and subsequent toolbar components are implemented.

## Dependencies

- `@tiptap/react`: ^2.27.1
- `@tiptap/starter-kit`: ^2.27.1
- `@blog-spec/editor`: workspace package (contains custom extensions)
- `react`: ^18.2.0

## Files Created

1. `/apps/web/components/editor/editor.tsx` - Main component
2. `/apps/web/components/editor/__tests__/editor.test.tsx` - Test suite
3. `/apps/web/package.json` - Package configuration for apps/web
4. `/apps/web/components/editor/README.md` - This file

## Next Steps (Remaining T039 Dependencies)

- **T040**: Create appearance controls UI component (font size, padding sliders)
- **T041**: Create tag editor UI component with editable suggestions
- **T042-T043**: Implement tag suggestion backend (OpenSearch + API route)
- **T044-T046**: Implement draft storage and auto-save API integration
- **T047**: Create compose page route (already updated to use Editor component)

## Verification

To verify T039 implementation:

```bash
# Run editor tests
cd apps/web
pnpm test components/editor/__tests__/editor.test.tsx

# Or run all tests
pnpm test
```

## Status in tasks.md

```markdown
- [x] T039 [P] [US1] Create editor React component in apps/web/components/editor/editor.tsx
```

---

**Completed**: 2025-11-14
**Methodology**: Test-Driven Development (TDD)
**Requirement Traceability**: FR-001 (Content Formatting), FR-009 (Appearance Controls)
