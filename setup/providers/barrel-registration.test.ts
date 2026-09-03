import { describe, expect, it } from 'vitest';

// Imports ONLY the barrel — and this file must never import './codex.js', even
// transitively. A direct import self-registers the provider, so the assertions
// below would pass with the barrel line deleted, which is the exact regression
// they exist to catch (setup/providers/codex.test.ts imports codex.js for its
// unit tests and therefore cannot guard this).
import './index.js';
import { getSetupProvider, listSetupProviders } from './registry.js';

describe('setup provider barrel', () => {
  it('registers codex via the barrel (guards the import line)', () => {
    expect(listSetupProviders().map((e) => e.value)).toContain('codex');
  });

  it('exposes the three hooks the setup flow dispatches on', () => {
    const entry = getSetupProvider('codex');

    // Absent runAuth, `--step provider-auth codex` stops at setup/provider-auth.ts:84
    // ("uses the standard auth flow") and never reaches the vault walk-through.
    expect(typeof entry?.runAuth).toBe('function');
    expect(typeof entry?.runInstallCheck).toBe('function');
    expect(typeof entry?.offerFailureAssist).toBe('function');
  });

  it('resolves case-insensitively, matching how resolveProviderName normalizes', () => {
    expect(getSetupProvider('CODEX')?.value).toBe('codex');
  });
});
