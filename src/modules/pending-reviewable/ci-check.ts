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
 * `gh` CLI (its own cron-refreshed hosts.yml credential), read-only. NOTE: the
 * host process DOES carry GH_TOKEN — systemd loads it from .env — so this
 * function strips it before exec'ing; see the comment at the call below. The
 * older claim that "the host has no GH_TOKEN in env" was wrong and cost 3,225
 * silent probe failures.
 * Returns true only when the named run exists AND concluded `success` (or
 * `neutral`/`skipped`, treated as non-blocking). Absent/failed/in-progress =>
 * false: do not release yet (a later check_suite will re-trigger the probe).
 */
import { execFile } from 'child_process';
import { promisify } from 'util';

import { log } from '../../log.js';

const execFileAsync = promisify(execFile);

const PASSING = new Set(['success', 'neutral', 'skipped']);

/**
 * The exact `gh` argv for the check-run probe.
 *
 * Extracted so it can be asserted on. The defect this replaced was ENTIRELY in
 * the argv — `--slurp` and `--jq` together, which `gh` rejects outright — and no
 * amount of testing the response parser would have caught it. See the test.
 */
export function checkRunArgs(repo: string, headSha: string): string[] {
  return ['api', `repos/${repo}/commits/${headSha}/check-runs`, '--paginate', '--slurp'];
}

/**
 * Pick the named check-run out of `gh api ... --paginate --slurp` output.
 *
 * WHY THIS IS TS AND NOT jq
 *
 * `--slurp` is load-bearing: without it `--paginate` applies a filter to EACH
 * page separately, so a commit whose check-runs span pages emits one result per
 * page and a naive parser reads "success\nnull" as a single conclusion. That is
 * real here — slang's heads carry ~134 runs across 2 pages. But `gh` rejects
 * `--slurp` alongside `--jq`, so the two cannot be combined and the selection
 * has to happen after the fact. Doing it here also means malformed output is a
 * caught parse error rather than a non-zero exit that looks like an API outage.
 *
 * Returns `"<status>/<conclusion>"` for the first matching run in page order
 * (the same run the previous jq expression's `.[0]` selected), or `''` when the
 * named run is not present yet — a normal state while CI is still starting.
 */
export function selectCheckRun(stdout: string, checkName: string): string {
  const raw = stdout.trim();
  if (!raw) return '';

  // --slurp yields ONE array whose elements are the per-page response objects.
  // Tolerate a bare single response too, so this keeps working if --paginate is
  // ever dropped for a commit that fits on one page.
  const parsed: unknown = JSON.parse(raw);
  const pages: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

  for (const page of pages) {
    const runs = (page as { check_runs?: unknown })?.check_runs;
    if (!Array.isArray(runs)) continue;
    for (const run of runs) {
      const r = run as { name?: unknown; status?: unknown; conclusion?: unknown };
      if (r?.name !== checkName) continue;
      // conclusion is null while a run is queued/in_progress. Render it as the
      // string "null" so the caller's status check ("completed") is what
      // decides, exactly as the jq interpolation used to behave.
      return `${String(r.status)}/${String(r.conclusion)}`;
    }
  }
  return '';
}

export async function requiredCheckRunGreen(repo: string, headSha: string, checkName: string): Promise<boolean> {
  try {
    // `gh` prefers $GH_TOKEN / $GITHUB_TOKEN over its stored hosts.yml
    // credential. The host process inherits GH_TOKEN from .env via systemd's
    // EnvironmentFile — which systemd reads ONCE at start — so the value is
    // pinned for the whole life of the process while the App installation token
    // it carries expires within the hour. hosts.yml is the credential that
    // actually stays fresh (refresh-gh-tokens.sh re-runs `gh auth login
    // --with-token` every 30 min), so strip the env vars and let gh use it.
    //
    // Measured on slang-coworkers prod 2026-08-05: the running service's env
    // carried a GH_TOKEN that returned `401 Bad credentials`, while the same
    // command from a shell (no GH_TOKEN set) succeeded. That accounted for
    // 3,225 probe failures against 4 successful releases — the approver was
    // almost never invited to review, which read as low "coverage".
    const { GH_TOKEN: _gh, GITHUB_TOKEN: _gt, ...ghEnv } = process.env;

    // --slurp is load-bearing: without it `gh` applies --jq to EACH page
    // separately, so a commit whose check-runs span pages emits one line per
    // page ("completed/success\nnull/null"). The old parser then split that on
    // "/" and produced conclusion="success\nnull", failing PASSING and holding
    // a genuinely green PR (observed on head 013675eb0c7f). --slurp wraps the
    // pages in one array so jq runs once; harvest-reviews.py already does this.
    // NO --jq HERE, DELIBERATELY. `gh` refuses `--slurp` together with `--jq`:
    //
    //   the `--slurp` option is not supported with `--jq` or `--template`
    //
    // and exits 1. That is not an API error, an auth error or a rate limit — the
    // invocation is simply rejected before a request is made, so it failed for
    // EVERY head on EVERY call. `requiredCheckRunGreen` therefore returned false
    // unconditionally and the approver was never invited to review, which
    // presented as a low ci_green rate rather than as a broken gate. Measured on
    // slang-coworkers prod 2026-08-10: 4,964 probe failures in one error log,
    // 81 of the last 100 error lines, against gh 2.96.0.
    //
    // --slurp is still load-bearing (see below), so the selection moves to TS.
    const { stdout } = await execFileAsync('gh', checkRunArgs(repo, headSha), {
      timeout: 20_000,
      maxBuffer: 8 * 1024 * 1024,
      env: ghEnv,
    });
    const val = selectCheckRun(stdout, checkName);
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
