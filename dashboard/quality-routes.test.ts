/**
 * Route contracts for the quality-panel additions in dashboard/server.ts:
 *
 *   GET /api/review-cycles-why   pass-through of data/shared/reports/review-cycles-why.json;
 *                                404 (normal until the miner runs), 200, 500 on damage.
 *   GET /api/approver-policy     the approver-policy check (dashboard/approver-policy.ts)
 *                                over the real DB, repo files and host logs.
 *   GET /api/infrastructure      carries the same check as `approverPolicy`.
 *
 * The server is pointed at a temp project root so reports/, data/, logs/ and the
 * ops/ policy of record are all fixtures.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { resetTransientDashboardStateForTests, startServer } from './server.js';
import { MOUNT_REJECTED_NEEDLE, POLICY_OF_RECORD_RELPATH } from './approver-policy.js';

const ROOT = mkdtempSync(path.join('/tmp', 'nanoclaw-quality-routes-'));
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'v2.db');
const LOGS_DIR = path.join(ROOT, 'logs');
const WHY_PATH = path.join(DATA_DIR, 'shared', 'reports', 'review-cycles-why.json');

let server: ReturnType<typeof startServer>;
let baseUrl = '';
let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  process.env.NANOCLAW_DASHBOARD_PROJECT_ROOT = ROOT;
  process.env.NANOCLAW_DASHBOARD_DATA_DIR = DATA_DIR;
  process.env.NANOCLAW_DASHBOARD_DB_PATH = DB_PATH;
  process.env.NANOCLAW_DASHBOARD_LOGS_DIR = LOGS_DIR;
  process.env.NANOCLAW_DASHBOARD_GROUPS_DIR = path.join(ROOT, 'groups');
  mkdirSync(path.join(ROOT, 'groups'), { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(LOGS_DIR, { recursive: true });
  resetTransientDashboardStateForTests();
  server = startServer(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected an ephemeral TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  resetTransientDashboardStateForTests();
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  consoleLogSpy.mockRestore();
  rmSync(DATA_DIR, { recursive: true, force: true });
  rmSync(LOGS_DIR, { recursive: true, force: true });
  rmSync(path.join(ROOT, 'ops'), { recursive: true, force: true });
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
  for (const k of [
    'NANOCLAW_DASHBOARD_PROJECT_ROOT',
    'NANOCLAW_DASHBOARD_DATA_DIR',
    'NANOCLAW_DASHBOARD_DB_PATH',
    'NANOCLAW_DASHBOARD_LOGS_DIR',
    'NANOCLAW_DASHBOARD_GROUPS_DIR',
  ]) {
    delete process.env[k];
  }
});

function seedLedger(rows: Array<{ repo: string; pr: number; policyVersion: string | null; decidedAt: string }>) {
  const db = new Database(DB_PATH);
  db.exec(`CREATE TABLE IF NOT EXISTS approval_decisions (
    repo TEXT NOT NULL, pr_number INTEGER NOT NULL, commit_sha TEXT NOT NULL, mode TEXT NOT NULL,
    decision TEXT NOT NULL, reason_code TEXT, review_diff_hash TEXT, policy_version TEXT, clauses_json TEXT,
    challenger_json TEXT, human_verdict TEXT, agent_group_id TEXT NOT NULL, session_id TEXT NOT NULL,
    thread_id TEXT, decided_at TEXT NOT NULL, provenance TEXT NOT NULL DEFAULT 'agent_verified',
    PRIMARY KEY (repo, pr_number, commit_sha))`);
  const ins = db.prepare(
    `INSERT INTO approval_decisions (repo, pr_number, commit_sha, mode, decision, policy_version, agent_group_id, session_id, decided_at)
     VALUES (?, ?, ?, 'live', 'ABSTAIN_POLICY', ?, 'ag-1', 'sess-1', ?)`,
  );
  rows.forEach((r, i) => ins.run(r.repo, r.pr, `sha-${i}`, r.policyVersion, r.decidedAt));
  db.close();
}

function writePolicyOfRecord(version: string) {
  const p = path.join(ROOT, POLICY_OF_RECORD_RELPATH);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify({ policy_version: version, require_ci_green: true }));
}

function writeRejectedLines(count: number, when: Date) {
  const stamp = when.toISOString();
  const lines = Array.from(
    { length: count },
    () => `[${stamp}] WARN ${MOUNT_REJECTED_NEEDLE} group="Slang PR Approver" reason="Host path does not exist"`,
  );
  writeFileSync(path.join(LOGS_DIR, 'nanoclaw.error.log'), lines.join('\n') + '\n');
}

describe('GET /api/review-cycles-why', () => {
  it('404s with a hint until the miner has written the file', async () => {
    const res = await fetch(`${baseUrl}/api/review-cycles-why`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('no mining snapshot');
    expect(body.hint).toMatch(/mining task/);
  });

  it('passes the mining JSON through verbatim', async () => {
    mkdirSync(path.dirname(WHY_PATH), { recursive: true });
    const doc = {
      generatedAt: '2026-09-09T12:00:00Z',
      items: [{ repo: 'shader-slang/slang', number: 12186, why: 'Six-week design review.' }],
    };
    writeFileSync(WHY_PATH, JSON.stringify(doc));
    const res = await fetch(`${baseUrl}/api/review-cycles-why`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(doc);
  });

  it('500s on a corrupt file rather than serving half a document', async () => {
    mkdirSync(path.dirname(WHY_PATH), { recursive: true });
    writeFileSync(WHY_PATH, '{ not json');
    const res = await fetch(`${baseUrl}/api/review-cycles-why`);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/unreadable/);
  });
});

describe('GET /api/approver-policy', () => {
  it('is unknown (not ok) with no DB and no logs', async () => {
    const body = await (await fetch(`${baseUrl}/api/approver-policy`)).json();
    expect(body.status).toBe('unknown');
    expect(body.latestDecision).toBeNull();
    expect(body.expectedVersion).toBeNull();
    expect(body.reasons).toContain('central DB unavailable');
    expect(body.mountRejections.count).toBe(0);
    expect(body.mountRejections.files.map((f: { scanned: boolean }) => f.scanned)).toEqual([false, false]);
  });

  it('warns when the latest row ran under the bundled policy, mismatches the record, and mounts were rejected', async () => {
    seedLedger([
      { repo: 'shader-slang/slang', pr: 12811, policyVersion: 'v0-shadow-wide', decidedAt: '2026-08-31T08:58:33Z' },
      { repo: 'shader-slang/slang', pr: 12844, policyVersion: 'v0-shadow', decidedAt: '2026-08-31T16:16:24Z' },
    ]);
    writePolicyOfRecord('v0-shadow-wide-r2');
    writeRejectedLines(3, new Date(Date.now() - 60 * 60 * 1000));
    const body = await (await fetch(`${baseUrl}/api/approver-policy`)).json();
    expect(body.status).toBe('warn');
    expect(body.latestDecision).toMatchObject({
      repo: 'shader-slang/slang',
      prNumber: 12844,
      policyVersion: 'v0-shadow',
    });
    expect(body.expectedVersion).toBe('v0-shadow-wide-r2');
    expect(body.expectedSource).toBe(POLICY_OF_RECORD_RELPATH);
    expect(body.bundledVersion).toBe('v0-shadow');
    expect(body.mountRejections.count).toBe(3);
    expect(body.mountRejections.files.find((f: { file: string }) => f.file === 'nanoclaw.error.log')).toMatchObject({
      scanned: true,
      count: 3,
    });
    expect(body.reasons.join(' ')).toMatch(/bundled "v0-shadow"/);
    expect(body.reasons.join(' ')).toMatch(/3 "Additional mount REJECTED" lines/);
  });

  it('is ok when the latest row matches the policy of record and nothing was rejected recently', async () => {
    seedLedger([
      { repo: 'shader-slang/slang', pr: 12844, policyVersion: 'v0-shadow', decidedAt: '2026-08-31T16:16:24Z' },
      {
        repo: 'slang-coworkers/nanoclaw',
        pr: 1500,
        policyVersion: 'v0-shadow-wide-r2',
        decidedAt: '2026-09-09T10:25:22Z',
      },
    ]);
    writePolicyOfRecord('v0-shadow-wide-r2');
    // Old rejections (from the incident) are outside the 24 h window and do not warn.
    writeRejectedLines(209, new Date(Date.now() - 9 * 24 * 60 * 60 * 1000));
    const body = await (await fetch(`${baseUrl}/api/approver-policy`)).json();
    expect(body.status).toBe('ok');
    expect(body.reasons).toEqual([]);
    expect(body.latestDecision.policyVersion).toBe('v0-shadow-wide-r2');
    expect(body.mountRejections.count).toBe(0);
  });

  it('warns on a mismatch even when the bundled version is not involved', async () => {
    seedLedger([
      { repo: 'shader-slang/slang', pr: 1, policyVersion: 'v0-shadow-wide', decidedAt: '2026-09-09T10:25:22Z' },
    ]);
    writePolicyOfRecord('v0-shadow-wide-r2');
    const body = await (await fetch(`${baseUrl}/api/approver-policy`)).json();
    expect(body.status).toBe('warn');
    expect(body.reasons.join(' ')).toMatch(/differs from the policy of record "v0-shadow-wide-r2"/);
  });
});

describe('GET /api/infrastructure', () => {
  it('carries the approver-policy check as `approverPolicy`', async () => {
    seedLedger([
      { repo: 'shader-slang/slang', pr: 12844, policyVersion: 'v0-shadow', decidedAt: '2026-08-31T16:16:24Z' },
    ]);
    const res = await fetch(`${baseUrl}/api/infrastructure`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.approverPolicy).toBeDefined();
    expect(body.approverPolicy.status).toBe('warn');
    expect(body.approverPolicy.latestDecision.policyVersion).toBe('v0-shadow');
    expect(Array.isArray(body.approverPolicy.reasons)).toBe(true);
  }, 40_000);
});
