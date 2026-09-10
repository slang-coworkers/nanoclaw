/**
 * Contract tests for the approver-policy infrastructure check
 * (dashboard/approver-policy.ts).
 *
 * The failure this check exists for was silent: a missing host directory made
 * every approver decision fall back to the bundled `v0-shadow` policy for nine
 * days, and the only symptom was a metric that read as a model regression. So
 * the properties pinned here are the ones that would let it go quiet again:
 *
 *   no evidence is `unknown`, never `ok`;
 *   the bundled version is a warning even when no policy of record is checked in;
 *   a mismatch against the policy of record is a warning;
 *   REJECTED lines are dated correctly across local midnight from time-only
 *   stamps (src/log.ts writes `[HH:MM:SS.mmm]`, no date).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  approverPolicyCheck,
  BUNDLED_POLICY_VERSION,
  countMountRejections,
  countRecentLogMatches,
  evaluateApproverPolicy,
  HOST_LOG_FILES,
  MOUNT_REJECTED_NEEDLE,
  parsePolicyVersion,
  POLICY_OF_RECORD_RELPATH,
  readExpectedPolicyVersion,
  readLatestApprovalDecision,
  sampleLogTail,
  type LogSample,
} from './approver-policy.js';

const noRejections = { count: 0, since: '', windowHours: 24, files: [] };
const rejections = (count: number) => ({ count, since: '', windowHours: 24, files: [] });
const latest = (policyVersion: string | null) => ({
  repo: 'shader-slang/slang',
  prNumber: 1,
  decision: 'ABSTAIN_POLICY',
  mode: 'live',
  policyVersion,
  decidedAt: '2026-09-09T10:25:22Z',
  provenance: 'agent_verified',
});

describe('parsePolicyVersion', () => {
  it('reads policy_version from a policy document', () => {
    expect(parsePolicyVersion('{"policy_version":"v0-shadow-wide-r2","allow_fork_head":true}')).toBe(
      'v0-shadow-wide-r2',
    );
  });
  it('is null for malformed JSON, a non-object, or a missing/blank field', () => {
    expect(parsePolicyVersion('{ nope')).toBeNull();
    expect(parsePolicyVersion('[]')).toBeNull();
    expect(parsePolicyVersion('{"policy_version":"  "}')).toBeNull();
    expect(parsePolicyVersion('{"other":1}')).toBeNull();
  });
});

describe('evaluateApproverPolicy', () => {
  it('is unknown, not ok, when there is no decision row', () => {
    const v = evaluateApproverPolicy(null, 'v0-shadow-wide-r2', noRejections);
    expect(v.status).toBe('unknown');
    expect(v.reasons.join(' ')).toMatch(/no approval_decisions row/);
  });

  it('warns on the bundled version even when no policy of record is available', () => {
    const v = evaluateApproverPolicy(latest(BUNDLED_POLICY_VERSION), null, noRejections);
    expect(v.status).toBe('warn');
    expect(v.reasons.join(' ')).toMatch(/bundled "v0-shadow"/);
  });

  it('warns when the latest decision differs from the policy of record', () => {
    const v = evaluateApproverPolicy(latest('v0-shadow-wide'), 'v0-shadow-wide-r2', noRejections);
    expect(v.status).toBe('warn');
    expect(v.reasons.join(' ')).toMatch(/differs from the policy of record "v0-shadow-wide-r2"/);
  });

  it('warns when a decision carries no policy_version at all', () => {
    expect(evaluateApproverPolicy(latest(null), 'v0-shadow-wide-r2', noRejections).status).toBe('warn');
  });

  it('warns on recent mount rejections even if the last recorded decision looks right', () => {
    // The rejection is the leading indicator: the NEXT decision will be bundled.
    const v = evaluateApproverPolicy(latest('v0-shadow-wide-r2'), 'v0-shadow-wide-r2', rejections(3));
    expect(v.status).toBe('warn');
    expect(v.reasons.join(' ')).toMatch(/3 "Additional mount REJECTED" lines/);
  });

  it('is ok when the versions match and nothing was rejected', () => {
    const v = evaluateApproverPolicy(latest('v0-shadow-wide-r2'), 'v0-shadow-wide-r2', noRejections);
    expect(v).toEqual({ status: 'ok', reasons: [] });
  });

  it('is ok with a non-bundled version when no policy of record exists to compare against', () => {
    expect(evaluateApproverPolicy(latest('v0-shadow-wide-r2'), null, noRejections).status).toBe('ok');
  });
});

describe('countRecentLogMatches: dating time-only stamps', () => {
  // src/log.ts writes `[HH:MM:SS.mmm] WARN msg key=val` in HOST-LOCAL time with no
  // date. The stamps below are built from local-time components so the test is
  // timezone-independent.
  const local = (y: number, mo: number, d: number, h: number, mi: number, s: number) =>
    new Date(y, mo - 1, d, h, mi, s, 0).getTime();
  const stamp = (h: number, mi: number, s: number) =>
    `[${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}.000]`;
  const rejected = (h: number, mi: number, s: number) =>
    `${stamp(h, mi, s)} \x1b[33mWARN\x1b[39m \x1b[36m${MOUNT_REJECTED_NEEDLE}\x1b[39m group="Slang PR Approver" reason="Host path does not exist"`;
  const info = (h: number, mi: number, s: number) => `${stamp(h, mi, s)} INFO Container spawned`;

  it('counts hits inside the window and dates lines across a midnight wrap', () => {
    // mtime = 2026-09-09 10:00 local. Lines (oldest first): two REJECTED at 22:10 and
    // 23:50 the day before, one at 01:00 today, one at 09:38 today. Window 24 h from
    // 10:00 today starts 10:00 yesterday, so all four are in; a 09:00 line two days
    // back (before the second wrap) is out.
    const text = [
      rejected(9, 0, 0), // 09-07 09:00: out of window
      info(23, 59, 0), // 09-07
      rejected(22, 10, 0), // 09-08
      rejected(23, 50, 0), // 09-08
      info(0, 30, 0), // 09-09
      rejected(1, 0, 0), // 09-09
      rejected(9, 38, 23), // 09-09
    ].join('\n');
    const sample: LogSample = { file: 'x', text, mtimeMs: local(2026, 9, 9, 10, 0, 0), truncated: false };
    const r = countRecentLogMatches(sample, MOUNT_REJECTED_NEEDLE, local(2026, 9, 9, 10, 0, 0), 24 * 3_600_000);
    expect(r).toEqual({ count: 4, undated: 0 });
  });

  it('excludes hits older than the window on the same calendar day', () => {
    const text = [rejected(8, 0, 0), rejected(12, 0, 0)].join('\n');
    const sample: LogSample = { file: 'x', text, mtimeMs: local(2026, 9, 9, 13, 0, 0), truncated: false };
    // 4 h window from 13:00 -> 09:00 cutoff: 12:00 in, 08:00 out.
    expect(countRecentLogMatches(sample, MOUNT_REJECTED_NEEDLE, local(2026, 9, 9, 13, 0, 0), 4 * 3_600_000).count).toBe(
      1,
    );
  });

  it('accepts full ISO stamps too and reports undated hits without counting them', () => {
    const nowMs = Date.parse('2026-09-09T10:00:00Z');
    const text = [
      `[2026-09-08T12:00:00.000Z] WARN ${MOUNT_REJECTED_NEEDLE} a=1`,
      `[2026-09-07T12:00:00.000Z] WARN ${MOUNT_REJECTED_NEEDLE} a=2`,
      `    at something (${MOUNT_REJECTED_NEEDLE} quoted in a stack line)`,
    ].join('\n');
    const sample: LogSample = { file: 'x', text, mtimeMs: nowMs, truncated: false };
    expect(countRecentLogMatches(sample, MOUNT_REJECTED_NEEDLE, nowMs, 24 * 3_600_000)).toEqual({
      count: 1,
      undated: 1,
    });
  });

  it('does not count a line that merely mentions a different message', () => {
    const text = [`${stamp(9, 0, 0)} WARN Additional mount accepted`].join('\n');
    const sample: LogSample = { file: 'x', text, mtimeMs: local(2026, 9, 9, 10, 0, 0), truncated: false };
    expect(
      countRecentLogMatches(sample, MOUNT_REJECTED_NEEDLE, local(2026, 9, 9, 10, 0, 0), 24 * 3_600_000).count,
    ).toBe(0);
  });
});

describe('countMountRejections across the host log files', () => {
  it('sums both files and marks unread files as not scanned', () => {
    const nowMs = Date.parse('2026-09-09T10:00:00Z');
    const err: LogSample = {
      file: 'nanoclaw.error.log',
      text: `[2026-09-09T09:38:23.000Z] WARN ${MOUNT_REJECTED_NEEDLE}\n[2026-09-09T09:39:00.000Z] WARN ${MOUNT_REJECTED_NEEDLE}`,
      mtimeMs: nowMs,
      truncated: true,
    };
    const r = countMountRejections([null, err], HOST_LOG_FILES, nowMs);
    expect(r.count).toBe(2);
    expect(r.windowHours).toBe(24);
    expect(r.files[0]).toMatchObject({ file: 'nanoclaw.log', scanned: false, count: 0 });
    expect(r.files[1]).toMatchObject({ file: 'nanoclaw.error.log', scanned: true, truncated: true, count: 2 });
  });
});

describe('filesystem + DB readers', () => {
  let root: string;
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
  });

  it('sampleLogTail reads only the tail and drops the partial first line', () => {
    root = mkdtempSync(path.join(tmpdir(), 'approver-policy-'));
    const p = path.join(root, 'nanoclaw.error.log');
    writeFileSync(p, 'line-one is long enough to be cut\nline-two\nline-three\n');
    const s = sampleLogTail(p, 20)!;
    expect(s.truncated).toBe(true);
    expect(s.text).toBe('line-three\n');
    const whole = sampleLogTail(p)!;
    expect(whole.truncated).toBe(false);
    expect(whole.text.startsWith('line-one')).toBe(true);
    expect(sampleLogTail(path.join(root, 'missing.log'))).toBeNull();
  });

  it('readExpectedPolicyVersion: absent file is a null version with no error; present file is parsed', () => {
    root = mkdtempSync(path.join(tmpdir(), 'approver-policy-'));
    expect(readExpectedPolicyVersion(root)).toEqual({ version: null, source: null, error: null });
    const p = path.join(root, POLICY_OF_RECORD_RELPATH);
    mkdirSync(path.dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify({ policy_version: 'v0-shadow-wide-r2' }));
    expect(readExpectedPolicyVersion(root)).toEqual({
      version: 'v0-shadow-wide-r2',
      source: POLICY_OF_RECORD_RELPATH,
      error: null,
    });
    writeFileSync(p, '{ broken');
    expect(readExpectedPolicyVersion(root).error).toMatch(/no policy_version/);
  });

  it('readLatestApprovalDecision: no table is null; latest by decided_at wins; provenance column optional', () => {
    root = mkdtempSync(path.join(tmpdir(), 'approver-policy-'));
    const db = new Database(path.join(root, 'v2.db'));
    expect(readLatestApprovalDecision(db)).toBeNull();
    // Pre-934 shape: no provenance column.
    db.exec(`CREATE TABLE approval_decisions (
      repo TEXT NOT NULL, pr_number INTEGER NOT NULL, commit_sha TEXT NOT NULL, mode TEXT NOT NULL,
      decision TEXT NOT NULL, policy_version TEXT, decided_at TEXT NOT NULL,
      PRIMARY KEY (repo, pr_number, commit_sha))`);
    expect(readLatestApprovalDecision(db)).toBeNull();
    const ins = db.prepare(
      'INSERT INTO approval_decisions (repo, pr_number, commit_sha, mode, decision, policy_version, decided_at) VALUES (?,?,?,?,?,?,?)',
    );
    ins.run('shader-slang/slang', 12844, 'aaa', 'live', 'ABSTAIN_POLICY', 'v0-shadow', '2026-08-31T16:16:24Z');
    ins.run(
      'slang-coworkers/nanoclaw',
      1500,
      'bbb',
      'live',
      'WOULD_APPROVE',
      'v0-shadow-wide-r2',
      '2026-09-09T10:25:22Z',
    );
    // Inserted out of order on purpose: the latest decided_at, not the last insert, wins.
    ins.run('shader-slang/slangpy', 7, 'ccc', 'live_late', 'BLOCK', 'v0-shadow-wide', '2026-09-01T00:00:00Z');
    const row = readLatestApprovalDecision(db)!;
    expect(row).toMatchObject({
      repo: 'slang-coworkers/nanoclaw',
      prNumber: 1500,
      policyVersion: 'v0-shadow-wide-r2',
      decidedAt: '2026-09-09T10:25:22Z',
      provenance: null,
    });
    db.exec("ALTER TABLE approval_decisions ADD COLUMN provenance TEXT NOT NULL DEFAULT 'agent_verified'");
    expect(readLatestApprovalDecision(db)!.provenance).toBe('agent_verified');
    db.close();
  });

  it('approverPolicyCheck composes the three signals into one verdict', () => {
    root = mkdtempSync(path.join(tmpdir(), 'approver-policy-'));
    const logs = path.join(root, 'logs');
    mkdirSync(logs, { recursive: true });
    const now = Date.parse('2026-09-09T10:00:00Z');
    writeFileSync(
      path.join(logs, 'nanoclaw.error.log'),
      `[2026-09-09T09:38:23.000Z] WARN ${MOUNT_REJECTED_NEEDLE} group="Slang PR Approver"\n`,
    );
    const db = new Database(path.join(root, 'v2.db'));
    db.exec(`CREATE TABLE approval_decisions (
      repo TEXT, pr_number INTEGER, commit_sha TEXT, mode TEXT, decision TEXT, policy_version TEXT, decided_at TEXT, provenance TEXT)`);
    db.prepare('INSERT INTO approval_decisions VALUES (?,?,?,?,?,?,?,?)').run(
      'shader-slang/slang',
      12844,
      'aaa',
      'live',
      'ABSTAIN_POLICY',
      'v0-shadow',
      '2026-08-31T16:16:24Z',
      'agent_verified',
    );
    const check = approverPolicyCheck({ db, projectRoot: root, logsDir: logs, now });
    expect(check.status).toBe('warn');
    expect(check.latestDecision?.policyVersion).toBe('v0-shadow');
    expect(check.expectedVersion).toBeNull(); // ops/ not in this checkout
    expect(check.mountRejections.count).toBe(1);
    expect(check.reasons.some((r) => /bundled/.test(r))).toBe(true);
    expect(check.reasons.some((r) => /REJECTED/.test(r))).toBe(true);
    expect(check.checkedAt).toBe('2026-09-09T10:00:00.000Z');

    // Without a DB the verdict cannot be ok either.
    const noDb = approverPolicyCheck({ db: null, projectRoot: root, logsDir: logs, now });
    expect(noDb.status).toBe('warn'); // still warns on the rejection
    expect(noDb.reasons).toContain('central DB unavailable');
    db.close();
  });
});
