import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Polyfills for ProseMirror/TipTap in JSDOM
// ProseMirror requires these DOM APIs for position calculation and selection handling

// Mock document.elementFromPoint (used by ProseMirror for coordinate-based lookups)
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// Mock Range.prototype.getClientRects (used for selection rendering)
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function () {
    return {
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* () {},
    } as DOMRectList;
  };
}

// Mock Element.prototype.getClientRects (used for layout calculations)
if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = function () {
    return {
      length: 1,
      item: () => ({
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect),
      [Symbol.iterator]: function* () {
        yield this.item(0)!;
      },
    } as DOMRectList;
  };
}

// Mock Element.prototype.getBoundingClientRect (used for scroll positioning)
const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
if (!originalGetBoundingClientRect || originalGetBoundingClientRect.toString().includes('[native code]')) {
  Element.prototype.getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

// CRITICAL: ProseMirror calls getBoundingClientRect on Text nodes too!
// Add polyfill to Text.prototype as well
if (typeof Text !== 'undefined' && !Text.prototype.getBoundingClientRect) {
  (Text.prototype as any).getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

// Also add to CharacterData which Text extends
if (typeof CharacterData !== 'undefined' && !CharacterData.prototype.getBoundingClientRect) {
  (CharacterData.prototype as any).getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

afterEach(() => {
  cleanup();
});
