import { describe, expect, it } from 'vitest';

import { rowLabelForThread } from './row-label.js';

describe('rowLabelForThread', () => {
  it('strips the hermes- prefix from a gap-matrix row thread', () => {
    expect(rowLabelForThread('hermes-LOOP-F35')).toBe('LOOP-F35');
    expect(rowLabelForThread('hermes-SELF-F56')).toBe('SELF-F56');
  });

  it('keeps everything after the prefix verbatim (rows may contain dashes / slashes)', () => {
    expect(rowLabelForThread('hermes-A2A-P3a/sub')).toBe('A2A-P3a/sub');
  });

  it('returns null for non-hermes threads', () => {
    expect(rowLabelForThread('gh-issue-shader-slang/slang-12165')).toBeNull();
    expect(rowLabelForThread('msg-1778143510824-x485si')).toBeNull();
    expect(rowLabelForThread('1723456789.123456')).toBeNull();
  });

  it('returns null for a bare prefix, other case, or a mid-string match', () => {
    expect(rowLabelForThread('hermes-')).toBeNull();
    expect(rowLabelForThread('Hermes-LOOP-F35')).toBeNull();
    expect(rowLabelForThread('x-hermes-LOOP-F35')).toBeNull();
  });

  it('returns null for null / undefined / non-string input', () => {
    expect(rowLabelForThread(null)).toBeNull();
    expect(rowLabelForThread(undefined)).toBeNull();
    expect(rowLabelForThread(42 as unknown as string)).toBeNull();
  });
});
