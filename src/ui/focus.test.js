import { prefersAutoFocus } from './focus';

const runtime = matches => ({ matchMedia: query => ({ matches: matches[query] ?? false }) });

describe('auto focus', () => {
  test('a mouse gets the search field focused for free', () => {
    expect(prefersAutoFocus(runtime({ '(hover: hover) and (pointer: fine)': true }))).toBe(true);
  });

  test('touch does not, because the keyboard would cover the list', () => {
    expect(prefersAutoFocus(runtime({ '(hover: hover) and (pointer: fine)': false }))).toBe(false);
  });

  test('a runtime that cannot answer keeps the old behaviour', () => {
    expect(prefersAutoFocus(undefined)).toBe(true);
    expect(prefersAutoFocus({})).toBe(true);
  });
});
