import { describe, expect, it } from 'bun:test';

import { hookTimeoutMs } from './intent-router-bridge.js';

describe('hookTimeoutMs', () => {
  it('keeps 4 s for Claude groups, whose Haiku call answers in about 2 s', () => {
    expect(hookTimeoutMs('claude')).toBe(4000);
  });

  it('gives non-Claude groups 8 s: luna through the gateway took up to 7.2 s', () => {
    expect(hookTimeoutMs('codex')).toBe(8000);
    expect(hookTimeoutMs('opencode')).toBe(8000);
  });
});
