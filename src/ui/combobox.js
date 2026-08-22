export function getPopoverPosition({
  rect,
  viewportWidth,
  viewportHeight,
  preferredHeight = 320,
  gutter = 8,
  gap = 8,
}) {
  const width = Math.min(rect.width, viewportWidth - (gutter * 2));
  const left = Math.min(
    Math.max(rect.left, gutter),
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

  return { top, left, width, maxHeight, placement };
}

export function nextOptionIndex(current, key, length) {
  if (length <= 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  if (key === 'ArrowDown') return current < 0 ? 0 : (current + 1) % length;
  if (key === 'ArrowUp') return current < 0 ? length - 1 : (current - 1 + length) % length;
  return current;
}
