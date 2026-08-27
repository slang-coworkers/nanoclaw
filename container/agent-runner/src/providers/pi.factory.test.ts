import { describe, it, expect } from 'bun:test';

import { createProvider } from './factory.js';
import { PiProvider } from './pi.js';

describe('createProvider (pi)', () => {
  it('returns PiProvider for pi', () => {
    expect(createProvider('pi')).toBeInstanceOf(PiProvider);
  });

  it('flags stale session errors as session-invalid', () => {
    const p = new PiProvider();
    expect(p.isSessionInvalid(new Error('session not found'))).toBe(true);
    expect(p.isSessionInvalid(new Error('No such session: abc'))).toBe(true);
    expect(p.isSessionInvalid(new Error('ENOENT: no such file, open /x/session.jsonl'))).toBe(true);
  });

  it('does not flag unrelated errors as session-invalid', () => {
    const p = new PiProvider();
    expect(p.isSessionInvalid(new Error('rate limit exceeded'))).toBe(false);
    expect(p.isSessionInvalid(new Error('connection reset'))).toBe(false);
    expect(p.isSessionInvalid(new Error('pi rpc exited: code=1 signal=null'))).toBe(false);
    expect(p.isSessionInvalid(new Error('Model not found: invalid/model'))).toBe(false);
  });

  it('declares no native slash command support', () => {
    const p = new PiProvider();
    expect(p.supportsNativeSlashCommands).toBe(false);
  });
});
