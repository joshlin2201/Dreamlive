// Focusing a search field on a tablet or phone throws the keyboard over half
// the screen before the operator has decided to type. Only a real pointer gets
// the focus for free; touch waits for a tap on the field.
export function prefersAutoFocus(runtime = typeof window !== 'undefined' ? window : undefined) {
  if (!runtime || typeof runtime.matchMedia !== 'function') return true;
  return Boolean(runtime.matchMedia('(hover: hover) and (pointer: fine)').matches);
}
