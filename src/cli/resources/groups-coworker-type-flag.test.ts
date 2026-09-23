// The --coworker-type flag must survive the CLI's arg normalization.
//
// `normalizeArgs` (cli/crud.ts) rewrites every --kebab-case flag to snake_case
// before a handler ever sees it, so a handler that reads `args['coworker-type']`
// gets `undefined` for a flag the operator definitely passed — the flag silently
// does nothing, and the template's own hint wins instead. That is the worst
// failure shape available here: no error, no log, just the wrong composition.
//
// The unit tests for the decision logic call createAgentFromTemplate directly
// and therefore cannot see this. This one goes through the registered command's
// own parseArgs, which is the seam dispatch uses (cli/dispatch.ts:181).

import { describe, expect, it } from 'vitest';

import '../resources/index.js';
import { lookup } from '../registry.js';

describe('groups create --coworker-type reaches the handler', () => {
  const cmd = lookup('groups-create');

  it('is a registered command', () => {
    expect(cmd).toBeDefined();
  });

  it('normalizes --coworker-type to the snake_case key the handler reads', () => {
    const parsed = cmd!.parseArgs({ template: 'sales/sdr', 'coworker-type': 'nanoclaw-writer' }) as Record<
      string,
      unknown
    >;
    expect(parsed.coworker_type).toBe('nanoclaw-writer');
    // Guard against a future handler reading the pre-normalization key.
    expect(parsed['coworker-type']).toBeUndefined();
  });

  it('preserves an empty value, which is the explicit opt-out', () => {
    const parsed = cmd!.parseArgs({ template: 'sales/sdr', 'coworker-type': '' }) as Record<string, unknown>;
    expect(parsed.coworker_type).toBe('');
    expect('coworker_type' in parsed).toBe(true);
  });

  it('omits the key entirely when the flag is absent, so the template hint applies', () => {
    const parsed = cmd!.parseArgs({ template: 'sales/sdr' }) as Record<string, unknown>;
    expect(parsed.coworker_type).toBeUndefined();
  });

  it('documents the flag in its help text', () => {
    expect(cmd!.description).toContain('--coworker-type');
  });
});
