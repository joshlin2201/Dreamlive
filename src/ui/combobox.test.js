import { getPopoverPosition, nextOptionIndex } from './combobox';

describe('track combobox helpers', () => {
  test('places the menu above when the trigger is near the viewport bottom', () => {
    const position = getPopoverPosition({
      rect: { top: 700, bottom: 744, left: 24, width: 320 },
      viewportWidth: 390,
      viewportHeight: 844,
      preferredHeight: 320,
    });

    expect(position.placement).toBe('top');
    expect(position.left).toBe(24);
    expect(position.width).toBe(320);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(692);
  });

  test('keeps a wide trigger menu inside a narrow viewport', () => {
    const position = getPopoverPosition({
      rect: { top: 100, bottom: 144, left: -12, width: 430 },
      viewportWidth: 390,
      viewportHeight: 844,
      preferredHeight: 320,
    });

    expect(position.left).toBe(8);
    expect(position.width).toBe(374);
    expect(position.placement).toBe('bottom');
  });

  test('gives a compact end-aligned trigger a usable menu without overflowing', () => {
    const position = getPopoverPosition({
      rect: { top: 100, bottom: 136, left: 874, right: 964, width: 90 },
      viewportWidth: 1024,
      viewportHeight: 768,
      preferredWidth: 320,
      align: 'end',
    });

    expect(position.width).toBe(320);
    expect(position.left).toBe(644);
    expect(position.left + position.width).toBeLessThanOrEqual(1016);
  });

  test('moves keyboard focus through options without leaving the list', () => {
    expect(nextOptionIndex(-1, 'ArrowDown', 4)).toBe(0);
    expect(nextOptionIndex(3, 'ArrowDown', 4)).toBe(0);
    expect(nextOptionIndex(0, 'ArrowUp', 4)).toBe(3);
    expect(nextOptionIndex(2, 'Home', 4)).toBe(0);
    expect(nextOptionIndex(1, 'End', 4)).toBe(3);
  });

  test('a menu placed above hangs from the control, not from an assumed height', () => {
    // A short two-item row menu near the middle of an iPad screen.
    const position = getPopoverPosition({
      rect: { top: 560, bottom: 596, left: 900, right: 940, width: 40 },
      viewportWidth: 1180,
      viewportHeight: 820,
      preferredHeight: 108,
      preferredWidth: 190,
      align: 'end',
    });

    if (position.placement === 'top') {
      // Bottom edge sits one gap above the trigger regardless of menu height.
      expect(820 - position.bottom).toBe(552);
    } else {
      expect(position.top).toBe(604);
    }
  });

  test('the bottom anchor never depends on how tall the menu turns out to be', () => {
    const rect = { top: 700, bottom: 744, left: 24, width: 320 };
    const short = getPopoverPosition({ rect, viewportWidth: 390, viewportHeight: 844, preferredHeight: 100 });
    const tall = getPopoverPosition({ rect, viewportWidth: 390, viewportHeight: 844, preferredHeight: 320 });
    expect(short.bottom).toBe(tall.bottom);
    expect(844 - short.bottom).toBe(692);
  });
});
