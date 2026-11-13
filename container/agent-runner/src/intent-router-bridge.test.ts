import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'bun:test';

import { HOOK_TIMEOUT_MS } from './intent-router-bridge.js';

describe('intent-router bridge budget', () => {
  it("is longer than each of the script's HTTP limits, so a slow classification still routes", () => {
    // The bridge kills the script at its budget. A curl limit at or above it
    // means a slow but valid answer is thrown away (Claude had 4 s against 5 s).
    const script = fs.readFileSync(path.join(import.meta.dir, '..', '..', 'hooks', 'intent-router.sh'), 'utf-8');
    const limits = [...script.matchAll(/--max-time ([0-9.]+)/g)].map((m) => Number(m[1]) * 1000);
    expect(limits.length).toBeGreaterThanOrEqual(2);
    for (const limit of limits) expect(limit).toBeLessThan(HOOK_TIMEOUT_MS);
  });

  it('matches the 8 s the host gives the script as a UserPromptSubmit hook', () => {
    expect(HOOK_TIMEOUT_MS).toBe(8000);
  });
});
