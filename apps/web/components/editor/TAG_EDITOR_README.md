# TagEditor Component (T041)

**Status**: ✅ Complete
**Branch**: `001-t038-tiptap-json-parser`
**Location**: `apps/web/components/editor/tag-editor.tsx`

## Overview

The TagEditor component provides a UI for managing article tags with auto-suggested tags from content analysis. It integrates with the tag suggestion API (T042-T043) to provide intelligent, editable tag recommendations while allowing full manual control.

## Features

### Tag Management (FR-003)
- ✅ **Add Tags**: Via input field + Enter key or Add button
- ✅ **Remove Tags**: Click X button on any tag chip
- ✅ **Auto-Suggestions**: Display AI-suggested tags from content analysis
- ✅ **One-Click Add**: Click suggested tags to add them
- ✅ **Case-Insensitive Deduplication**: Prevents duplicate tags regardless of case
- ✅ **Whitespace Trimming**: Auto-trims leading/trailing whitespace
- ✅ **Min/Max Validation**: Enforces tag count limits with visual feedback
- ✅ **Loading State**: Shows progress when fetching suggestions
- ✅ **Keyboard Accessible**: Full keyboard navigation support

### Implementation Highlights
- ✅ **Controlled Component**: React state management with onChange callbacks
- ✅ **Smart Filtering**: Auto-hides suggested tags that are already added
- ✅ **Error Resilience**: Graceful handling of callback errors
- ✅ **Visual Distinction**: Different styling for added vs suggested tags
- ✅ **Accessibility**: ARIA labels, keyboard navigation, screen reader support
- ✅ **Performance**: useCallback memoization prevents unnecessary re-renders

## API

### Props

```typescript
interface TagEditorProps {
  /** Current list of tags */
  tags: string[];

  /** Suggested tags from API (optional) */
  suggestedTags?: string[];

  /** Whether suggestions are currently loading */
  isLoadingSuggestions?: boolean;

  /** Callback triggered when tags change */
  onChange: (tags: string[]) => void;

  /** Callback to request tag suggestions (optional) */
  onRequestSuggestions?: () => void;

  /** Minimum number of tags required (default: 0) */
  minTags?: number;

  /** Maximum number of tags allowed (default: undefined = unlimited) */
  maxTags?: number;

  /** Additional CSS class name */
  className?: string;
}
```

### Tag Validation Rules

```typescript
// Deduplication
- Case-insensitive comparison
- Whitespace-trimmed before comparison

// Input Validation
- Empty tags rejected
- Whitespace-only tags rejected
- Duplicate tags rejected (case-insensitive)

// Count Limits
- minTags: Shows error message when below threshold
- maxTags: Disables input/suggestions when reached
```

## Usage Examples

### Standalone Usage

```tsx
import TagEditor from '@/components/editor/tag-editor';

function MyEditor() {
  const [tags, setTags] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleRequestSuggestions = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/articles/123/tags/suggest');
      const data = await response.json();
      setSuggestions(data.tags);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TagEditor
      tags={tags}
      onChange={setTags}
      suggestedTags={suggestions}
      isLoadingSuggestions={loading}
      onRequestSuggestions={handleRequestSuggestions}
      minTags={1}
      maxTags={5}
    />
  );
}
```

### Integration with Compose Page

```tsx
import Editor from '@/components/editor/editor';
import TagEditor from '@/components/editor/tag-editor';

function ComposePage() {
  const [articleData, setArticleData] = useState({
    content: '',
    tags: [] as string[],
  });
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const handleContentChange = (content: string) => {
    setArticleData(prev => ({ ...prev, content }));
  };

  const handleTagsChange = (tags: string[]) => {
    setArticleData(prev => ({ ...prev, tags }));
  };

  const handleRequestSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const response = await fetch('/api/articles/draft-123/tags/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: articleData.content }),
      });
      const data = await response.json();
      setSuggestedTags(data.tags || []);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <div>
      <Editor
        initialContent={{ mdx: articleData.content }}
        onChange={(state) => handleContentChange(state.mdx)}
      />
      <TagEditor
        tags={articleData.tags}
        onChange={handleTagsChange}
        suggestedTags={suggestedTags}
        isLoadingSuggestions={loadingSuggestions}
        onRequestSuggestions={handleRequestSuggestions}
        minTags={1}
        maxTags={10}
      />
    </div>
  );
}
```

### Read-Only Display

```tsx
// Display tags without editing capability
<TagEditor
  tags={['react', 'typescript', 'nodejs']}
  onChange={() => {}} // No-op
  // Omit onRequestSuggestions to hide suggest button
/>
```

## Component Structure

```
TagEditor
├── Header Section
│   ├── "Tags" Label + Count Display
│   └── "Suggest Tags" Button (optional)
├── Current Tags Display
│   ├── Tag Chip 1 (blue background)
│   │   ├── Tag Text
│   │   └── Remove Button (×)
│   ├── Tag Chip 2
│   └── ...
├── Add Tag Input Section
│   ├── Text Input Field
│   └── Add Button
├── Validation Messages
│   ├── Min Tags Error (red background)
│   └── Max Tags Error (red background, auto-dismisses after 3s)
├── Loading Indicator
│   └── "Loading suggestions..." (italic text)
└── Suggested Tags Section
    ├── "Suggested:" Label
    └── Suggested Tag Buttons (dashed border)
        ├── + tag1
        ├── + tag2
        └── ...
```

## Testing

Tests are located at: `apps/web/components/editor/__tests__/tag-editor.test.tsx`

### Test Coverage

- ✅ **Rendering** (5 tests)
  - Empty tags list rendering
  - Existing tags as removable chips
  - Add tag input rendering
  - Suggested tags display
  - Loading state indication

- ✅ **Adding Tags** (8 tests)
  - Add via Enter key
  - Add via button click
  - Input clearing after add
  - Whitespace trimming
  - Empty tag rejection
  - Duplicate detection
  - Case-insensitive deduplication
  - Appending to existing tags

- ✅ **Removing Tags** (2 tests)
  - Single tag removal
  - Multiple independent removals

- ✅ **Suggested Tags** (4 tests)
  - Add suggested tag on click
  - Filter out already-added tags
  - Request suggestions button
  - Disable suggest button while loading

- ✅ **Validation** (4 tests)
  - Min tags error display
  - Min tags requirement met
  - Max tags enforcement
  - Disable controls at max

- ✅ **Accessibility** (3 tests)
  - Screen reader labels
  - Keyboard navigation
  - Tag count announcement

- ✅ **Visual Feedback** (2 tests)
  - Tag addition feedback
  - Added vs suggested styling

- ✅ **Error Handling** (2 tests)
  - onChange errors
  - onRequestSuggestions errors

**Total**: 30 tests, all passing ✅

### Running Tests

```bash
# Run TagEditor tests
cd apps/web
pnpm vitest run components/editor/__tests__/tag-editor.test.tsx

# Run with coverage
pnpm vitest run --coverage components/editor/__tests__/tag-editor.test.tsx

# Watch mode during development
pnpm vitest watch components/editor/__tests__/tag-editor.test.tsx
```

## Implementation Insights

`★ Insight ─────────────────────────────────────`
**Key Design Decisions**:
1. **Case-Insensitive Deduplication** - Normalizes tags to lowercase for comparison while preserving original case in display, preventing "React" and "react" duplicates
2. **Controlled Component Pattern** - Parent component manages tags array state, TagEditor reports changes via onChange, enabling integration with form state management
3. **Filtered Suggestions** - Automatically filters suggested tags to exclude already-added ones (case-insensitive), preventing confusion and duplicate suggestions
4. **Error State Management** - showMaxError state with setTimeout auto-dismiss provides temporary feedback without permanent UI clutter
5. **Disabled State Logic** - Disables input/button/suggestions when maxTags reached, preventing invalid state rather than allowing and rejecting
`─────────────────────────────────────────────────`

## Visual Design

The component uses a clean, card-based design:
- Light gray background (`#f9fafb`)
- Border for definition (`#e5e7eb`)
- Blue tag chips (`#3b82f6`) for added tags
- Dashed border suggestions for visual distinction
- Hover effects on interactive elements
- Red error messages (`#dc2626` on `#fee2e2`)

```
┌─────────────────────────────────────────────────────┐
│ Tags (3)                        [Suggest Tags]      │
│                                                      │
│ ┌────────┐ ┌──────────────┐ ┌────────────┐         │
│ │ react × │ │ typescript × │ │ next.js  × │         │
│ └────────┘ └──────────────┘ └────────────┘         │
│                                                      │
│ ┌──────────────────────────────────┐ ┌──────┐      │
│ │ Add a tag...                     │ │ Add  │      │
│ └──────────────────────────────────┘ └──────┘      │
│                                                      │
│ Suggested:                                          │
│ ┌─────────┐ ┌──────────┐ ┌───────────┐            │
│ │ + nodejs │ │ + webpack │ │ + graphql │            │
│ └─────────┘ └──────────┘ └───────────┘            │
└─────────────────────────────────────────────────────┘
```

## Dependencies

- `react`: ^18.2.0
- No external UI libraries (uses native HTML inputs and buttons)

## Files Created

1. `/apps/web/components/editor/tag-editor.tsx` - Component implementation (432 lines)
2. `/apps/web/components/editor/__tests__/tag-editor.test.tsx` - Test suite (30 tests, 391 lines)
3. `/apps/web/components/editor/TAG_EDITOR_README.md` - This documentation

## Integration Points

**Integrates With**:
- ⏳ T042: OpenSearch keyword extraction Lambda (provides tag suggestions)
- ⏳ T043: POST /api/articles/[articleId]/tags/suggest route (API endpoint)
- ⏳ T044: POST /api/articles route (includes tags in article creation)
- ⏳ T047: Compose page (will integrate tag editor in UI)

**Ready For**:
- ⏳ Tag suggestion API integration (T042-T043)
- ⏳ Article metadata management (tags field in article model)
- ⏳ Draft auto-save with tags (T044-T046)

## Data Flow

```
User Action → TagEditor
              ↓
        onChange(newTags)
              ↓
        Parent Component
        (updates state)
              ↓
        TagEditor Rerenders
        (with new tags prop)

Suggestion Flow:
User Clicks "Suggest Tags"
              ↓
    onRequestSuggestions()
              ↓
        Parent Component
    (calls API endpoint)
              ↓
    Sets suggestedTags prop
              ↓
        TagEditor Rerenders
    (displays suggestions)
```

## Validation Behavior

### Minimum Tags
- **When**: `tags.length < minTags`
- **Effect**: Shows persistent red error message
- **Message**: "At least {minTags} tag(s) required"
- **Does NOT**: Block tag removal (allows user to fix incrementally)

### Maximum Tags
- **When**: `tags.length >= maxTags`
- **Effect**:
  - Disables input field
  - Disables Add button
  - Disables suggested tag buttons
  - Shows temporary error on add attempt (3s auto-dismiss)
- **Message**: "Maximum {maxTags} tags allowed"
- **Prevents**: Adding tags beyond limit

## Future Enhancements

- [ ] Add tag autocomplete from existing article tags
- [ ] Implement tag categories/groups
- [ ] Add tag popularity indicators
- [ ] Support tag synonyms/aliases
- [ ] Add tag color coding by category
- [ ] Implement drag-and-drop tag reordering
- [ ] Add tag export/import functionality
- [ ] Support custom tag validation rules

## Status in tasks.md

```markdown
- [x] T041 [P] [US1] Create tag editor UI component with editable suggestions in apps/web/components/editor/tag-editor.tsx
```

---

**Completed**: 2025-11-14
**Methodology**: Test-Driven Development (TDD)
**Requirement Traceability**: FR-003 (Auto-Suggested Tags)
**Test Results**: 30/30 tests passing ✅
