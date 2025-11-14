# AppearanceControls Component (T040)

**Status**: ✅ Complete
**Branch**: `001-t038-tiptap-json-parser`
**Location**: `apps/web/components/editor/appearance-controls.tsx`

## Overview

The AppearanceControls component provides a UI for controlling article appearance settings (font size and left padding). It integrates with the Editor component and the TipTap AppearanceExtension (T035) to provide live preview and persistence of appearance settings.

## Features

### Appearance Settings (FR-009)
- ✅ **Font Size Control**: Slider for 14-24px range (default: 16px)
- ✅ **Left Padding Control**: Slider for 0-64px range (default: 0px)
- ✅ **Live Preview**: Displays current values in real-time
- ✅ **Reset to Defaults**: One-click reset button
- ✅ **Value Clamping**: Automatically clamps to valid ranges
- ✅ **Accessibility**: Full ARIA labels and keyboard navigation

### Implementation Highlights
- ✅ **Native HTML range inputs**: Broad browser compatibility
- ✅ **Controlled components**: React state with useEffect sync
- ✅ **Error resilience**: Graceful handling of onChange errors
- ✅ **Input validation**: validateNumber helper for NaN/invalid values
- ✅ **Performance**: useCallback memoization prevents unnecessary re-renders

## API

### Props

```typescript
interface AppearanceControlsProps {
  fontSize?: number;        // Current font size (14-24px)
  leftPadding?: number;     // Current left padding (0-64px)
  onChange?: (settings: {
    fontSize: number;
    leftPadding: number;
  }) => void;
  className?: string;       // Additional CSS class
}
```

### Constraints

```typescript
// Font Size
MIN: 14px
MAX: 24px
DEFAULT: 16px
STEP: 1px

// Left Padding
MIN: 0px
MAX: 64px
DEFAULT: 0px
STEP: 4px
```

## Usage Example

### Standalone Usage

```tsx
import AppearanceControls from '@/components/editor/appearance-controls';

function MyEditor() {
  const [appearance, setAppearance] = useState({
    fontSize: 16,
    leftPadding: 0
  });

  return (
    <AppearanceControls
      fontSize={appearance.fontSize}
      leftPadding={appearance.leftPadding}
      onChange={setAppearance}
    />
  );
}
```

### Integration with Editor Component

```tsx
import Editor from '@/components/editor/editor';
import AppearanceControls from '@/components/editor/appearance-controls';

function ComposePage() {
  const editorRef = useRef<Editor>(null);
  const [appearance, setAppearance] = useState({
    fontSize: 16,
    leftPadding: 0
  });

  const handleAppearanceChange = (settings) => {
    setAppearance(settings);
    // Apply to editor
    if (editorRef.current) {
      editorRef.current.commands.setAppearance(settings);
    }
  };

  return (
    <div>
      <AppearanceControls
        fontSize={appearance.fontSize}
        leftPadding={appearance.leftPadding}
        onChange={handleAppearanceChange}
      />
      <Editor
        ref={editorRef}
        initialContent={{ appearance }}
      />
    </div>
  );
}
```

## Component Structure

```
AppearanceControls
├── Font Size Section
│   ├── Label + Live Value Display
│   ├── Range Input (14-24px, step 1)
│   └── Min/Max Labels
├── Left Padding Section
│   ├── Label + Live Value Display
│   ├── Range Input (0-64px, step 4)
│   └── Min/Max Labels
└── Reset Button
```

## Testing

Tests are located at: `apps/web/components/editor/__tests__/appearance-controls.test.tsx`

### Test Coverage

- ✅ **Rendering** (5 tests)
  - Font size control rendering
  - Left padding control rendering
  - Current value display
  - Default values

- ✅ **Font Size Slider** (4 tests)
  - Correct attributes (min/max/step)
  - Value updates
  - Min/max clamping
  - Live preview

- ✅ **Left Padding Slider** (4 tests)
  - Correct attributes (min/max/step)
  - Value updates
  - Min/max clamping
  - Live preview

- ✅ **onChange Callback** (3 tests)
  - Font size changes
  - Padding changes
  - Unchanged values

- ✅ **Reset Functionality** (2 tests)
  - Reset button presence
  - Reset to defaults

- ✅ **Accessibility** (3 tests)
  - Screen reader labels
  - Keyboard navigation
  - Unit display (px)

- ✅ **Visual Feedback** (1 test)
  - Value change display

- ✅ **Error Handling** (2 tests)
  - onChange errors
  - Invalid prop values

**Total**: 26 tests, all passing ✅

### Running Tests

```bash
# Run AppearanceControls tests
cd apps/web
pnpm vitest run components/editor/__tests__/appearance-controls.test.tsx

# Run with coverage
pnpm vitest run --coverage components/editor/__tests__/appearance-controls.test.tsx
```

## Implementation Insights

`★ Insight ─────────────────────────────────────`
**Key Design Decisions**:
1. **fireEvent vs userEvent** - Range inputs require `fireEvent.change()` instead of `userEvent.type()` for reliable testing
2. **Controlled components** - useState + useEffect sync ensures props can update UI while maintaining internal state for immediate feedback
3. **Validation at boundaries** - validateNumber + clamp helpers ensure invalid inputs (NaN, out-of-range) never break the UI
4. **Error isolation** - try-catch around onChange prevents parent component errors from crashing the slider UI
`─────────────────────────────────────────────────`

## Visual Design

The component uses a clean, minimal design with:
- Light gray background (`#f9fafb`)
- Border for definition (`#e5e7eb`)
- Hover effects on reset button
- Clear labels and value displays
- Min/max range indicators

```
┌─────────────────────────────────────┐
│ Font Size              16px         │
│ ━━━━━━━━━━●━━━━━━━━━━              │
│ 14px                          24px  │
│                                     │
│ Left Padding           32px         │
│ ━━━━━━━━━━●━━━━━━━━━━              │
│ 0px                           64px  │
│                                     │
│       [Reset to Defaults]           │
└─────────────────────────────────────┘
```

## Dependencies

- `react`: ^18.2.0
- No external UI libraries (uses native HTML inputs)

## Files Created

1. `/apps/web/components/editor/appearance-controls.tsx` - Component implementation
2. `/apps/web/components/editor/__tests__/appearance-controls.test.tsx` - Test suite (26 tests)
3. `/apps/web/components/editor/APPEARANCE_CONTROLS_README.md` - This documentation

## Integration Points

**Integrates With**:
- ✅ T035: AppearanceExtension (provides constraints and validation)
- ✅ T039: Editor component (provides appearance API)
- ⏳ T047: Compose page (will integrate appearance controls in UI)

**Ready For**:
- ⏳ T041: Tag editor UI component (parallel implementation)
- ⏳ T044-T046: Draft storage API (persistence of appearance settings)

## Next Steps

- [ ] Integrate AppearanceControls into compose page UI (T047)
- [ ] Add CSS transitions for smoother slider interactions
- [ ] Consider adding number input fields alongside sliders for precise values
- [ ] Add preview pane showing actual appearance changes in real-time

## Status in tasks.md

```markdown
- [x] T040 [P] [US1] Create appearance controls UI component in apps/web/components/editor/appearance-controls.tsx
```

---

**Completed**: 2025-11-14
**Methodology**: Test-Driven Development (TDD)
**Requirement Traceability**: FR-009 (Appearance Controls)
**Test Results**: 26/26 tests passing ✅
