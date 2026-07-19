/**
 * Host-side check-run conclusion probe for the approver CI gate.
 *
 * A `check_suite=success` webhook is the cheap WAKE trigger, but on repos where
 * every GitHub Actions workflow shares one app slug (`github-actions`), the
 * suite payload can't tell the real build roll-up from a trivial workflow
 * (lint/label/pages) that went green first. `check_run` events would carry the
 * name, but the App isn't subscribed to them (only `check_suite` is delivered).
 *
 * So when CI_GATE_REQUIRED_CHECK_RUN is set (e.g. "check-ci", slang's aggregate
 * roll-up), we resolve the truth at release time by querying `gh` directly for
 * that named check-run's conclusion at the head. Uses the host's authenticated
 * `gh` CLI (its own config/token — the host has no GH_TOKEN in env), read-only.
 * Returns true only when the named run exists AND concluded `success` (or
 * `neutral`/`skipped`, treated as non-blocking). Absent/failed/in-progress =>
 * false: do not release yet (a later check_suite will re-trigger the probe).
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

import { log } from '../../log.js';

const execFileAsync = promisify(execFile);

const PASSING = new Set(['success', 'neutral', 'skipped']);

export async function requiredCheckRunGreen(repo: string, headSha: string, checkName: string): Promise<boolean> {
  try {
    // Read-only. --paginate + jq filter avoids the ?check_name= param (which
    // some GHES versions ignore) — filter client-side on the exact name.
    const { stdout } = await execFileAsync(
      'gh',
      [
        'api',
        `repos/${repo}/commits/${headSha}/check-runs`,
        '--paginate',
        '--jq',
        `[.check_runs[] | select(.name=="${checkName}")] | .[0] | "\\(.status)/\\(.conclusion)"`,
      ],
      { timeout: 20_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const val = stdout.trim(); // "completed/success", "in_progress/", or "" if absent
    if (!val || val === 'null/null') {
      log.info('ci-gate: required check-run not present yet — not releasing', {
        repo,
        head: headSha.slice(0, 12),
        checkName,
      });
      return false;
    }
    const [status, conclusion] = val.split('/');
    const green = status === 'completed' && PASSING.has(conclusion);
    log.info('ci-gate: required check-run probe', {
      repo,
      head: headSha.slice(0, 12),
      checkName,
      status,
      conclusion,
      green,
    });
    return green;
  } catch (e) {
    // gh failure (auth/rate-limit/network) — do NOT release on a probe we
    // couldn't complete; a later check_suite success re-runs this.
    log.warn('ci-gate: check-run probe failed — not releasing', {
      repo,
      head: headSha.slice(0, 12),
      checkName,
      err: String(e).slice(0, 200),
    });
    return false;
  }
}
