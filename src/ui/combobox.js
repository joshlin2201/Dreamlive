export function getPopoverPosition({
  rect,
  viewportWidth,
  viewportHeight,
  preferredHeight = 320,
  preferredWidth = rect.width,
  align = 'start',
  gutter = 8,
  gap = 8,
}) {
  const width = Math.min(Math.max(rect.width, preferredWidth), viewportWidth - (gutter * 2));
  const anchorLeft = align === 'end' ? rect.right - width : rect.left;
  const left = Math.min(
    Math.max(anchorLeft, gutter),
    viewportWidth - gutter - width,
  );
  const availableBelow = viewportHeight - rect.bottom - gutter - gap;
  const availableAbove = rect.top - gutter - gap;
  const placement = availableBelow < preferredHeight && availableAbove > availableBelow
    ? 'top'
    : 'bottom';
  const maxHeight = Math.max(
    120,
    Math.min(preferredHeight, placement === 'top' ? availableAbove : availableBelow),
  );
  const top = placement === 'top'
    ? Math.max(gutter, rect.top - gap - maxHeight)
    : rect.bottom + gap;
  // A menu placed above is anchored by its BOTTOM edge. Anchoring by `top`
  // assumes the menu is exactly `maxHeight` tall, so a short menu - the two-item
  // row actions - floats hundreds of pixels above the control it belongs to.
  const bottom = Math.max(gutter, viewportHeight - rect.top + gap);

  return { top, bottom, left, width, maxHeight, placement };
}

export function nextOptionIndex(current, key, length) {
  if (length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % length;
  if (key === 'ArrowUp') return current < 0 ? length - 1 : (current - 1 + length) % length;
  return current;
}
