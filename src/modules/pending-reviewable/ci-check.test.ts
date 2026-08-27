import { describe, expect, it } from 'vitest';

import { checkRunArgs, selectCheckRun } from './ci-check.js';

/**
 * The defect these guard against was invisible to every response-shaped test.
 *
 * `gh api ... --paginate --slurp --jq <expr>` is rejected by gh before any HTTP
 * request happens:
 *
 *   the `--slurp` option is not supported with `--jq` or `--template`
 *
 * exit 1. So the probe failed for every head, on every call, and
 * `requiredCheckRunGreen` returned false unconditionally — the approver was
 * never invited and it presented as a low ci_green rate, not as a broken gate.
 * 4,964 failures accumulated in one prod error log before anyone read it.
 *
 * The bug lived entirely in the ARGV. That is why the argv is asserted directly.
 */
describe('checkRunArgs', () => {
  it('never combines --slurp with --jq, which gh rejects outright', () => {
    const args = checkRunArgs('shader-slang/slang', 'd7f3c47fcc85');
    expect(args).toContain('--slurp');
    // The whole regression, in one assertion.
    expect(args).not.toContain('--jq');
    expect(args).not.toContain('--template');
  });

  it('keeps --paginate, without which multi-page heads are silently truncated', () => {
    // Real slang heads carry ~134 check-runs across 2 pages.
    expect(checkRunArgs('shader-slang/slang', 'abc123')).toContain('--paginate');
  });

  it('targets the commit check-runs endpoint for the given repo and sha', () => {
    expect(checkRunArgs('owner/repo', 'deadbeef')).toContain('repos/owner/repo/commits/deadbeef/check-runs');
  });
});

/** One page of `gh api .../check-runs` output. */
function page(...runs: Array<{ name: string; status: string; conclusion: string | null }>) {
  return { total_count: runs.length, check_runs: runs };
}

describe('selectCheckRun', () => {
  it('finds a run that only appears on a LATER page', () => {
    // This is precisely what --slurp exists for. Before it, --paginate applied
    // the filter per page and the caller saw "null" from page 1.
    const stdout = JSON.stringify([
      page({ name: 'actionlint', status: 'completed', conclusion: 'success' }),
      page({ name: 'check-ci', status: 'completed', conclusion: 'success' }),
    ]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('completed/success');
  });

  it('returns empty when the named run is not present yet', () => {
    // Normal while CI is still starting — the caller logs info, not a warning.
    const stdout = JSON.stringify([page({ name: 'actionlint', status: 'completed', conclusion: 'success' })]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('');
  });

  it('reports an in-flight run as not-completed rather than as absent', () => {
    // conclusion is null until the run finishes. The caller gates on
    // status === 'completed', so this must NOT collapse to '' — that would be
    // indistinguishable from "no such check" and hide a running build.
    const stdout = JSON.stringify([page({ name: 'check-ci', status: 'in_progress', conclusion: null })]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('in_progress/null');
  });

  it('does not match a different check whose name merely contains the target', () => {
    const stdout = JSON.stringify([page({ name: 'check-ci-extra', status: 'completed', conclusion: 'failure' })]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('');
  });

  it('takes the first match in page order, as the previous .[0] did', () => {
    const stdout = JSON.stringify([
      page(
        { name: 'check-ci', status: 'completed', conclusion: 'success' },
        { name: 'check-ci', status: 'completed', conclusion: 'failure' },
      ),
    ]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('completed/success');
  });

  it('tolerates a bare single response object, not only a slurped array', () => {
    const stdout = JSON.stringify(page({ name: 'check-ci', status: 'completed', conclusion: 'neutral' }));
    expect(selectCheckRun(stdout, 'check-ci')).toBe('completed/neutral');
  });

  it('returns empty for empty output instead of throwing', () => {
    expect(selectCheckRun('', 'check-ci')).toBe('');
    expect(selectCheckRun('   \n ', 'check-ci')).toBe('');
  });

  it('skips pages that carry no check_runs array', () => {
    const stdout = JSON.stringify([
      { message: 'Not Found' },
      page({ name: 'check-ci', status: 'completed', conclusion: 'success' }),
    ]);
    expect(selectCheckRun(stdout, 'check-ci')).toBe('completed/success');
  });

  it('throws on malformed JSON so the caller logs a real failure', () => {
    // Deliberate: a parse error belongs in the catch block as a genuine
    // problem. Returning '' here would report corrupt output as "not ready
    // yet" and hold the PR forever with nothing in the log to explain it.
    expect(() => selectCheckRun('{not json', 'check-ci')).toThrow();
  });
});
