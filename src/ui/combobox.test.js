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

  test('moves keyboard focus through options without leaving the list', () => {
    expect(nextOptionIndex(-1, 'ArrowDown', 4)).toBe(0);
    expect(nextOptionIndex(3, 'ArrowDown', 4)).toBe(0);
    expect(nextOptionIndex(0, 'ArrowUp', 4)).toBe(3);
    expect(nextOptionIndex(2, 'Home', 4)).toBe(0);
    expect(nextOptionIndex(1, 'End', 4)).toBe(3);
  });
});
