import { describe, expect, it, vi, beforeEach } from 'vitest';

// promisify(execFile) resolves via the custom symbol, so the mock must expose it
// or `const { stdout } = await execFileAsync(...)` destructures a bare string.
const PROMISIFY_CUSTOM = Symbol.for('nodejs.util.promisify.custom');

const calls: Array<{ file: string; args: string[]; opts: Record<string, unknown> }> = [];
let nextStdout = '';
let nextThrow: Error | null = null;

vi.mock('child_process', () => {
  const execFile = ((...a: unknown[]) => a) as unknown as Record<symbol, unknown>;
  execFile[PROMISIFY_CUSTOM] = (file: string, args: string[], opts: Record<string, unknown>) => {
    calls.push({ file, args, opts });
    if (nextThrow) return Promise.reject(nextThrow);
    return Promise.resolve({ stdout: nextStdout, stderr: '' });
  };
  return { execFile };
});

const { requiredCheckRunGreen } = await import('./ci-check.js');

beforeEach(() => {
  calls.length = 0;
  nextStdout = '';
  nextThrow = null;
});

describe('requiredCheckRunGreen — credential handling', () => {
  it('strips GH_TOKEN/GITHUB_TOKEN so gh uses its cron-refreshed hosts.yml', async () => {
    // Regression (prod 2026-08-05): the host service inherits GH_TOKEN from .env
    // via systemd EnvironmentFile, which is read ONCE at start. The App token it
    // carries dies within the hour, gh prefers it over hosts.yml, and every probe
    // 401'd — 3,225 failures against 4 releases, so the approver was never invited.
    process.env.GH_TOKEN = 'ghs_expired_pinned_at_boot';
    process.env.GITHUB_TOKEN = 'ghp_also_stale';
    nextStdout = 'completed/success';

    await requiredCheckRunGreen('shader-slang/slang', 'a'.repeat(40), 'check-ci');

    const env = calls[0].opts.env as Record<string, string | undefined>;
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.PATH).toBeDefined(); // the rest of the environment survives

    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });
});

describe('requiredCheckRunGreen — pagination', () => {
  it('passes --slurp so --jq runs once across pages, not once per page', async () => {
    nextStdout = 'completed/success';
    await requiredCheckRunGreen('shader-slang/slang', 'b'.repeat(40), 'check-ci');
    expect(calls[0].args).toContain('--slurp');
    // the jq must flatten the slurped page array
    expect(calls[0].args.join(' ')).toContain('.[].check_runs[]');
  });

  it('does not hold a green PR when the response still spans lines', async () => {
    // The old parser split "completed/success\nnull/null" on "/" and produced
    // conclusion="success\nnull", which failed PASSING and held a green PR
    // (observed in prod on head 013675eb0c7f).
    nextStdout = 'completed/success\nnull/null';
    await expect(requiredCheckRunGreen('shader-slang/slang', 'c'.repeat(40), 'check-ci')).resolves.toBe(true);
  });

  it('is still false when every line is null (run genuinely absent)', async () => {
    nextStdout = 'null/null\nnull/null';
    await expect(requiredCheckRunGreen('shader-slang/slang', 'd'.repeat(40), 'check-ci')).resolves.toBe(false);
  });

  it('is false for a failed conclusion, and for a probe that throws', async () => {
    nextStdout = 'completed/failure';
    await expect(requiredCheckRunGreen('shader-slang/slang', 'e'.repeat(40), 'check-ci')).resolves.toBe(false);
    nextThrow = new Error('Command failed: gh api ...');
    await expect(requiredCheckRunGreen('shader-slang/slang', 'f'.repeat(40), 'check-ci')).resolves.toBe(false);
  });
});
