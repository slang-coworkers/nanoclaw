/**
 * Approver-policy infrastructure check: is Verity deciding under the policy of
 * record, or did it silently fall back to the bundled default?
 *
 * WHY THIS EXISTS. On 2026-08-31 the prod host moved and the signed
 * v0-shadow-wide policy, which lived only on the old box's /ephemeral disk, was
 * not copied. `validateAdditionalMounts` rejected the approver groups' mount
 * (`Additional mount REJECTED ... reason="Host path does not exist"`, 209 lines
 * over nine days), every approver container spawned without it, and
 * eval-clauses.py fell back to the bundled narrow `v0-shadow`. Nothing went red.
 * The only visible symptom was the Verity agreement panel dropping from 36% to
 * 3%, which read as a model regression and was not one.
 *
 * Three signals, each cheap, together make the failure loud:
 *
 *   1. the `policy_version` on the LATEST `approval_decisions` row;
 *   2. the `policy_version` of the policy of record checked into the repo at
 *      ops/slang-coworkers-prod/approver-policy/APPROVAL_POLICY.json (present on
 *      the prod checkout; absent on branches that do not carry ops/, in which
 *      case only the bundled-version check applies);
 *   3. the number of `Additional mount REJECTED` WARN lines in the host logs in
 *      the last 24 h.
 *
 * `status` is `warn` when the latest decision ran under the bundled version,
 * when it differs from the policy of record, or when mounts were rejected in the
 * window; `unknown` when there is no decision row to judge (never `ok` on no
 * evidence); `ok` otherwise.
 *
 * LOG FORMAT. src/log.ts stamps lines `[HH:MM:SS.mmm]` in host-local time with
 * no date, and writes warn+ to stderr, so under launchd/systemd the REJECTED
 * lines land in logs/nanoclaw.error.log (stdout goes to logs/nanoclaw.log). Both
 * files are scanned; the streams are disjoint so nothing is double-counted. Dates
 * are recovered by walking each file backward from its mtime and stepping one
 * day back every time the time-of-day jumps forward, which is exactly the
 * monotonicity the incident analysis relied on. Only a bounded tail of each file
 * is read so the check stays cheap enough for a panel load.
 */
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';

export const BUNDLED_POLICY_VERSION = 'v0-shadow';
export const POLICY_OF_RECORD_RELPATH = join('ops', 'slang-coworkers-prod', 'approver-policy', 'APPROVAL_POLICY.json');
export const MOUNT_REJECTED_NEEDLE = 'Additional mount REJECTED';
export const MOUNT_REJECTED_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Host log files scanned, in order. warn+ goes to stderr (src/log.ts), so the second is the one that usually carries the hits. */
export const HOST_LOG_FILES = ['nanoclaw.log', 'nanoclaw.error.log'] as const;
/** Bytes read from the end of each log file. ~3 MB/day on prod, so this covers the window with headroom. */
export const LOG_TAIL_BYTES = 8 * 1024 * 1024;
/**
 * Going backward through a file, a time-of-day that INCREASES by more than this
 * means the previous line was written on the day before. Lines within one
 * process are ordered, so anything bigger than write jitter is a midnight wrap.
 */
const DAY_WRAP_TOLERANCE_MS = 60 * 1000;

export interface LatestApprovalDecision {
  repo: string;
  prNumber: number;
  decision: string;
  mode: string | null;
  policyVersion: string | null;
  decidedAt: string;
  provenance: string | null;
}

export interface LogSample {
  file: string;
  text: string;
  /** Anchor for date recovery: the file's last-modified time. */
  mtimeMs: number;
  /** True when only a tail was read (older lines beyond it were not seen). */
  truncated: boolean;
}

export interface MountRejectionFileCount {
  file: string;
  count: number;
  scanned: boolean;
  truncated: boolean;
  /** Matches whose line carried no parseable timestamp; reported, never counted. */
  undated: number;
}

export interface MountRejectionCount {
  count: number;
  since: string;
  windowHours: number;
  files: MountRejectionFileCount[];
}

export type ApproverPolicyStatus = 'ok' | 'warn' | 'unknown';

export interface ApproverPolicyCheck {
  status: ApproverPolicyStatus;
  reasons: string[];
  latestDecision: LatestApprovalDecision | null;
  expectedVersion: string | null;
  /** Repo-relative path the expected version was read from, or null when the file is not in this checkout. */
  expectedSource: string | null;
  expectedError: string | null;
  bundledVersion: string;
  mountRejections: MountRejectionCount;
  checkedAt: string;
}

/** The `policy_version` string of an APPROVAL_POLICY.json body, or null when absent or unparseable. */
export function parsePolicyVersion(text: string): string | null {
  try {
    const doc = JSON.parse(text) as unknown;
    if (!doc || typeof doc !== 'object') return null;
    const v = (doc as Record<string, unknown>).policy_version;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function readExpectedPolicyVersion(projectRoot: string): {
  version: string | null;
  source: string | null;
  error: string | null;
} {
  const p = join(projectRoot, POLICY_OF_RECORD_RELPATH);
  if (!existsSync(p)) return { version: null, source: null, error: null };
  let text: string;
  try {
    text = readFileSync(p, 'utf-8');
  } catch (err) {
    return { version: null, source: POLICY_OF_RECORD_RELPATH, error: `unreadable: ${(err as Error).message}` };
  }
  const version = parsePolicyVersion(text);
  return {
    version,
    source: POLICY_OF_RECORD_RELPATH,
    error: version ? null : 'policy of record has no policy_version',
  };
}

/**
 * Latest approval_decisions row by decided_at. Tolerates a checkout whose DB
 * predates migration 934 (no `provenance` column) and one with no ledger at all
 * (returns null; the caller reports `unknown`, not `ok`).
 */
export function readLatestApprovalDecision(db: Database.Database): LatestApprovalDecision | null {
  let cols: Set<string>;
  try {
    const info = db.prepare('PRAGMA table_info(approval_decisions)').all() as Array<{ name: string }>;
    cols = new Set(info.map((c) => c.name));
  } catch {
    return null;
  }
  if (!cols.has('policy_version') || !cols.has('decided_at')) return null;
  const provenance = cols.has('provenance') ? 'provenance' : 'NULL AS provenance';
  const mode = cols.has('mode') ? 'mode' : 'NULL AS mode';
  try {
    const row = db
      .prepare(
        `SELECT repo, pr_number, decision, ${mode}, policy_version, decided_at, ${provenance}
         FROM approval_decisions ORDER BY decided_at DESC LIMIT 1`,
      )
      .get() as
      | {
          repo: string;
          pr_number: number;
          decision: string;
          mode: string | null;
          policy_version: string | null;
          decided_at: string;
          provenance: string | null;
        }
      | undefined;
    if (!row) return null;
    return {
      repo: row.repo,
      prNumber: row.pr_number,
      decision: row.decision,
      mode: row.mode ?? null,
      policyVersion: typeof row.policy_version === 'string' && row.policy_version.trim() ? row.policy_version : null,
      decidedAt: row.decided_at,
      provenance: row.provenance ?? null,
    };
  } catch {
    return null;
  }
}

/** Read the last `maxBytes` of a file. The partial leading line of a truncated read is dropped. */
export function sampleLogTail(path: string, maxBytes = LOG_TAIL_BYTES): LogSample | null {
  if (!existsSync(path)) return null;
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    const st = fstatSync(fd);
    const size = st.size;
    const start = Math.max(0, size - maxBytes);
    const len = size - start;
    const buf = Buffer.alloc(len);
    let off = 0;
    while (off < len) {
      const n = readSync(fd, buf, off, len - off, start + off);
      if (n <= 0) break;
      off += n;
    }
    let text = buf.toString('utf-8', 0, off);
    const truncated = start > 0;
    if (truncated) {
      const nl = text.indexOf('\n');
      text = nl >= 0 ? text.slice(nl + 1) : '';
    }
    return { file: path, text, mtimeMs: st.mtimeMs, truncated };
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        /* ignore */
      }
    }
  }
}

const TIME_ONLY_STAMP = /^\[(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/;
const FULL_STAMP = /^\[?(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)(Z|[+-]\d{2}:?\d{2})?\]?/;

/** Milliseconds since local midnight for a Date, matching src/log.ts's local-time getters. */
function localTimeOfDayMs(d: Date): number {
  return ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds();
}

function localMidnightMs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Count lines containing `needle` whose recovered timestamp is within
 * [nowMs - windowMs, nowMs]. See the module header for the date-recovery rule.
 */
export function countRecentLogMatches(
  sample: LogSample,
  needle: string,
  nowMs: number,
  windowMs: number,
): { count: number; undated: number } {
  const cutoff = nowMs - windowMs;
  const lines = sample.text.split('\n');
  const anchor = new Date(sample.mtimeMs);
  // Walk from the end: the last line is at most as late as the file's mtime.
  let dayStartMs = localMidnightMs(anchor);
  let laterTod = localTimeOfDayMs(anchor);
  let count = 0;
  let undated = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line) continue;
    const hit = line.includes(needle);
    let stampMs: number | null = null;
    const full = FULL_STAMP.exec(line);
    if (full) {
      const iso = `${full[1]}T${full[2]}${full[3] ? full[3] : ''}`;
      const t = Date.parse(iso);
      stampMs = Number.isFinite(t) ? t : null;
    } else {
      const m = TIME_ONLY_STAMP.exec(line);
      if (m) {
        const ms = m[4] ? Number(m[4].padEnd(3, '0')) : 0;
        const tod = ((Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + ms;
        // Going backward, a later time-of-day than the line after it means we
        // crossed local midnight: this line belongs to the previous day.
        if (tod > laterTod + DAY_WRAP_TOLERANCE_MS) dayStartMs -= 24 * 60 * 60 * 1000;
        laterTod = tod;
        stampMs = dayStartMs + tod;
      }
    }
    if (!hit) continue;
    if (stampMs === null) {
      undated++;
      continue;
    }
    if (stampMs >= cutoff && stampMs <= nowMs + DAY_WRAP_TOLERANCE_MS) count++;
  }
  return { count, undated };
}

export function countMountRejections(
  samples: Array<LogSample | null>,
  files: readonly string[],
  nowMs: number,
  windowMs = MOUNT_REJECTED_WINDOW_MS,
): MountRejectionCount {
  const perFile: MountRejectionFileCount[] = files.map((file, i) => {
    const s = samples[i];
    if (!s) return { file, count: 0, scanned: false, truncated: false, undated: 0 };
    const r = countRecentLogMatches(s, MOUNT_REJECTED_NEEDLE, nowMs, windowMs);
    return { file, count: r.count, scanned: true, truncated: s.truncated, undated: r.undated };
  });
  return {
    count: perFile.reduce((a, f) => a + f.count, 0),
    since: new Date(nowMs - windowMs).toISOString(),
    windowHours: Math.round(windowMs / 3_600_000),
    files: perFile,
  };
}

export function evaluateApproverPolicy(
  latest: LatestApprovalDecision | null,
  expectedVersion: string | null,
  mountRejections: MountRejectionCount,
  bundledVersion = BUNDLED_POLICY_VERSION,
): { status: ApproverPolicyStatus; reasons: string[] } {
  const reasons: string[] = [];
  if (mountRejections.count > 0) {
    reasons.push(
      `${mountRejections.count} "${MOUNT_REJECTED_NEEDLE}" line${mountRejections.count === 1 ? '' : 's'} in the last ${mountRejections.windowHours} h: approver containers are spawning without the policy mount`,
    );
  }
  if (!latest) {
    return { status: reasons.length ? 'warn' : 'unknown', reasons: [...reasons, 'no approval_decisions row to judge'] };
  }
  if (!latest.policyVersion) {
    reasons.push('latest decision carries no policy_version');
  } else if (latest.policyVersion === bundledVersion) {
    reasons.push(
      `latest decision ran under the bundled "${bundledVersion}" policy (the policy-of-record mount was missing at spawn)`,
    );
  } else if (expectedVersion && latest.policyVersion !== expectedVersion) {
    reasons.push(
      `latest decision policy_version "${latest.policyVersion}" differs from the policy of record "${expectedVersion}"`,
    );
  }
  return { status: reasons.length ? 'warn' : 'ok', reasons };
}

export function approverPolicyCheck(opts: {
  db: Database.Database | null;
  projectRoot: string;
  logsDir: string;
  now?: number;
}): ApproverPolicyCheck {
  const nowMs = opts.now ?? Date.now();
  const latest = opts.db ? readLatestApprovalDecision(opts.db) : null;
  const expected = readExpectedPolicyVersion(opts.projectRoot);
  const samples = HOST_LOG_FILES.map((f) => sampleLogTail(join(opts.logsDir, f)));
  const mountRejections = countMountRejections(samples, HOST_LOG_FILES, nowMs);
  const verdict = evaluateApproverPolicy(latest, expected.version, mountRejections);
  const reasons = [...verdict.reasons];
  if (!opts.db) reasons.push('central DB unavailable');
  if (expected.error) reasons.push(expected.error);
  return {
    status: verdict.status,
    reasons,
    latestDecision: latest,
    expectedVersion: expected.version,
    expectedSource: expected.source,
    expectedError: expected.error,
    bundledVersion: BUNDLED_POLICY_VERSION,
    mountRejections,
    checkedAt: new Date(nowMs).toISOString(),
  };
}
