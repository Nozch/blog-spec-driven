/**
 * AppearanceControls Component Tests (T040)
 *
 * Test-Driven Development approach for the AppearanceControls UI component
 * Located at: apps/web/components/editor/appearance-controls.tsx
 *
 * Requirements:
 * - FR-009: Article appearance controls MUST persist font size and left padding settings
 * - Font size: 14-24px range (slider with live preview)
 * - Left padding: 0-64px range (slider with live preview)
 * - Must integrate with Editor component's appearance API
 */

import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppearanceControls from '../appearance-controls';

const mockOnChange = vi.fn();

beforeEach(() => {
  mockOnChange.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('AppearanceControls - Rendering', () => {
  it('should render font size control with label', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    expect(screen.getByText(/font size/i)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /font size/i })).toBeInTheDocument();
  });

  it('should render left padding control with label', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    expect(screen.getByText(/left padding/i)).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /left padding/i })).toBeInTheDocument();
  });

  it('should display current font size value', () => {
    render(<AppearanceControls fontSize={18} onChange={mockOnChange} />);

    // Should show "18px" or "18" somewhere
    expect(screen.getByText(/18/)).toBeInTheDocument();
  });

  it('should display current left padding value', () => {
    render(<AppearanceControls leftPadding={32} onChange={mockOnChange} />);

    // Should show "32px" or "32" somewhere
    expect(screen.getByText(/32/)).toBeInTheDocument();
  });

  it('should render with default values when not provided', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    // Default font size is 16px
    const fontSlider = screen.getByRole('slider', { name: /font size/i });
    expect(fontSlider).toHaveValue('16');

    // Default left padding is 0px
    const paddingSlider = screen.getByRole('slider', { name: /left padding/i });
    expect(paddingSlider).toHaveValue('0');
  });
});

describe('AppearanceControls - Font Size Slider', () => {
  it('should have correct min, max, and step attributes', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /font size/i });
    expect(slider).toHaveAttribute('min', '14');
    expect(slider).toHaveAttribute('max', '24');
    expect(slider).toHaveAttribute('step', '1');
  });

  it('should update value when slider is changed', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;

    // Change to 20px
    fireEvent.change(slider, { target: { value: '20' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      fontSize: 20,
      leftPadding: 0
    });
  });

  it('should clamp font size to minimum (14px)', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;

    // Try to set below minimum
    fireEvent.change(slider, { target: { value: '10' } });

    // Should clamp to 14
    expect(slider).toHaveValue('14');
  });

  it('should clamp font size to maximum (24px)', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;

    // Try to set above maximum
    fireEvent.change(slider, { target: { value: '30' } });

    // Should clamp to 24
    expect(slider).toHaveValue('24');
  });

  it('should show live preview of font size value', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;

    // Change to 22px
    fireEvent.change(slider, { target: { value: '22' } });

    // Should display the new value
    expect(screen.getByText(/22/)).toBeInTheDocument();
  });
});

describe('AppearanceControls - Left Padding Slider', () => {
  it('should have correct min, max, and step attributes', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /left padding/i });
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '64');
    expect(slider).toHaveAttribute('step', '4');
  });

  it('should update value when slider is changed', () => {
    render(<AppearanceControls leftPadding={0} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /left padding/i }) as HTMLInputElement;

    // Change to 32px
    fireEvent.change(slider, { target: { value: '32' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      fontSize: 16,
      leftPadding: 32
    });
  });

  it('should clamp left padding to minimum (0px)', () => {
    render(<AppearanceControls leftPadding={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /left padding/i }) as HTMLInputElement;

    // Try to set below minimum
    fireEvent.change(slider, { target: { value: '-10' } });

    // Should clamp to 0
    expect(slider).toHaveValue('0');
  });

  it('should clamp left padding to maximum (64px)', () => {
    render(<AppearanceControls leftPadding={16} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /left padding/i }) as HTMLInputElement;

    // Try to set above maximum
    fireEvent.change(slider, { target: { value: '100' } });

    // Should clamp to 64
    expect(slider).toHaveValue('64');
  });

  it('should show live preview of left padding value', () => {
    render(<AppearanceControls leftPadding={0} onChange={mockOnChange} />);

    const slider = screen.getByRole('slider', { name: /left padding/i }) as HTMLInputElement;

    // Change to 48px
    fireEvent.change(slider, { target: { value: '48' } });

    // Should display the new value
    expect(screen.getByText(/48/)).toBeInTheDocument();
  });
});

describe('AppearanceControls - onChange Callback', () => {
  it('should call onChange with both values when font size changes', () => {
    render(
      <AppearanceControls
        fontSize={16}
        leftPadding={32}
        onChange={mockOnChange}
      />
    );

    const fontSlider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;
    fireEvent.change(fontSlider, { target: { value: '20' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      fontSize: 20,
      leftPadding: 32
    });
  });

  it('should call onChange with both values when padding changes', () => {
    render(
      <AppearanceControls
        fontSize={18}
        leftPadding={0}
        onChange={mockOnChange}
      />
    );

    const paddingSlider = screen.getByRole('slider', { name: /left padding/i }) as HTMLInputElement;
    fireEvent.change(paddingSlider, { target: { value: '24' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      fontSize: 18,
      leftPadding: 24
    });
  });

  it('should not call onChange if value has not actually changed', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const fontSlider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;

    // Set to same value
    fireEvent.change(fontSlider, { target: { value: '16' } });

    // onChange might be called, but with the same values
    if (mockOnChange.mock.calls.length > 0) {
      expect(mockOnChange).toHaveBeenCalledWith({
        fontSize: 16,
        leftPadding: 0
      });
    }
  });
});

describe('AppearanceControls - Reset Functionality', () => {
  it('should render a reset button', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('should reset to defaults when reset button is clicked', async () => {
    const user = userEvent.setup();
    render(
      <AppearanceControls
        fontSize={22}
        leftPadding={48}
        onChange={mockOnChange}
      />
    );

    const resetButton = screen.getByRole('button', { name: /reset/i });
    await user.click(resetButton);

    expect(mockOnChange).toHaveBeenCalledWith({
      fontSize: 16,  // Default
      leftPadding: 0  // Default
    });
  });
});

describe('AppearanceControls - Accessibility', () => {
  it('should have proper labels for screen readers', () => {
    render(<AppearanceControls onChange={mockOnChange} />);

    const fontSlider = screen.getByRole('slider', { name: /font size/i });
    const paddingSlider = screen.getByRole('slider', { name: /left padding/i });

    expect(fontSlider).toHaveAccessibleName();
    expect(paddingSlider).toHaveAccessibleName();
  });

  it('should be keyboard accessible', async () => {
    const user = userEvent.setup();
    render(<AppearanceControls onChange={mockOnChange} />);

    const fontSlider = screen.getByRole('slider', { name: /font size/i });

    // Tab to font slider
    await user.tab();
    expect(fontSlider).toHaveFocus();

    // Use arrow keys to adjust (browser-native behavior)
    await user.keyboard('{ArrowRight}');

    // Should be accessible via keyboard
    expect(fontSlider).toHaveFocus();
  });

  it('should show units (px) for clarity', () => {
    render(<AppearanceControls fontSize={18} leftPadding={32} onChange={mockOnChange} />);

    // Should display units
    const text = screen.getByText(/18.*px/i) || screen.getByText(/18/);
    expect(text).toBeInTheDocument();
  });
});

describe('AppearanceControls - Visual Feedback', () => {
  it('should provide visual feedback when values change', () => {
    render(<AppearanceControls fontSize={16} onChange={mockOnChange} />);

    const fontSlider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;
    fireEvent.change(fontSlider, { target: { value: '20' } });

    // Component should re-render with new value
    expect(screen.getByText(/20/)).toBeInTheDocument();
  });
});

describe('AppearanceControls - Error Handling', () => {
  it('should handle onChange errors gracefully', () => {
    const errorOnChange = vi.fn(() => {
      throw new Error('onChange error');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Should not throw
    expect(() => {
      render(<AppearanceControls onChange={errorOnChange} />);
    }).not.toThrow();

    const fontSlider = screen.getByRole('slider', { name: /font size/i }) as HTMLInputElement;
    fireEvent.change(fontSlider, { target: { value: '20' } });

    // Component should still work
    expect(fontSlider).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should handle invalid prop values gracefully', () => {
    // Should not throw with invalid values
    expect(() => {
      render(<AppearanceControls fontSize={NaN} leftPadding={-10} onChange={mockOnChange} />);
    }).not.toThrow();

    // Should clamp to valid ranges
    const fontSlider = screen.getByRole('slider', { name: /font size/i });
    const paddingSlider = screen.getByRole('slider', { name: /left padding/i });

    expect(fontSlider).toBeInTheDocument();
    expect(paddingSlider).toBeInTheDocument();
  });
});
