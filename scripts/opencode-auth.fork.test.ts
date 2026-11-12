import fs from 'fs';
import { describe, expect, it } from 'vitest';

// Fork-owned: opencode-auth.ts is a skill payload file that a refresh of
// /add-opencode overwrites. The entered API key rides in the discovery request's
// Authorization header, and fetch quotes an invalid header value in its error,
// so the warning setup prints must never carry the key. Skipped when
// /add-opencode is not installed.
describe.skipIf(!fs.existsSync(new URL('./opencode-auth.ts', import.meta.url)))('discoveryFailureReason', async () => {
  const { discoveryFailureReason } = await import('./opencode-auth.js');
  const key = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';

  it('redacts the entered key from a fetch header-validation error', () => {
    const error = new TypeError(`Headers.append: "Bearer ${key}\u0000" is an invalid header value.`);
    const reason = discoveryFailureReason(error, key);
    expect(reason).not.toContain(key);
    expect(reason).toContain('[redacted]');
  });

  it('redacts the key from a nested cause before truncating, so no prefix survives the cut', () => {
    const error = new TypeError('fetch failed', { cause: new Error(`${'x'.repeat(180)} Bearer ${key}`) });
    const reason = discoveryFailureReason(error, key);
    expect(reason.length).toBeLessThanOrEqual(200);
    expect(reason).not.toContain(key.slice(0, 12));
  });

  it('keeps the reason as before when no key was entered', () => {
    const error = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('self-signed certificate'), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }),
    });
    expect(discoveryFailureReason(error, undefined)).toBe('self-signed certificate');
  });
});
