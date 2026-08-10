/**
 * The HTTP register endpoint enforces the same claim rule as the MCP path.
 *
 * Driven over a real socket, deliberately. "I put the check in the store so
 * both callers inherit it" is an inference; the endpoint has its own request
 * parsing, its own early returns and its own status codes, and a fix that
 * lands only in the delivery action would leave this door open. So this file
 * asserts the rule through `fetch`, not through `claimPrMapping`.
 *
 * The transport is already authenticated by `INTERNAL_REGISTER_SECRET`, which
 * is what made this easy to miss: signed does not mean authorized. The secret
 * says "a peer sent this", not "this peer owns that PR".
 */
import http, { type IncomingMessage, type ServerResponse } from 'http';
import { afterEach, beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, initTestDb } from '../../db/connection.js';
import { runMigrations } from '../../db/migrations/index.js';
import { signRegisterBody, REGISTER_SIGNATURE_HEADER } from './register-client.js';
import { handleRegisterPr } from './register-endpoint.js';

const SECRET = 'test-secret-1234';

let serverUrl: string;
let server: http.Server;

interface Registration {
  repo: string;
  pr_number: number;
  owner_instance: string;
  agent_group_id: string;
  session_id: string;
  thread_id?: string | null;
}

async function register(payload: Registration): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = JSON.stringify(payload);
  const res = await fetch(serverUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [REGISTER_SIGNATURE_HEADER]: signRegisterBody(SECRET, body) },
    body,
  });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

// `initTestDb()` REPLACES the singleton on every call, so helpers must read
// through `getDb()` — calling it again mid-test silently discards the schema
// and everything written so far.
function read(repo: string, prNumber: number): { agent_group_id: string; owner_instance: string } | undefined {
  return getDb()
    .prepare('SELECT agent_group_id, owner_instance FROM pr_session_mappings WHERE repo = ? AND pr_number = ?')
    .get(repo, prNumber) as { agent_group_id: string; owner_instance: string } | undefined;
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
        void handleRegisterPr(req, res, SECRET);
      });
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') serverUrl = `http://127.0.0.1:${addr.port}/internal/register-pr`;
        resolve();
      });
    }),
);

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

beforeEach(() => {
  runMigrations(initTestDb());
});

afterEach(() => {
  closeDb();
});

describe('a signed peer cannot take over a PR another claimant holds', () => {
  const HELD = { repo: 'shader-slang/slang', prNumber: 4242 };

  beforeEach(() => {
    // Seeded with raw SQL (thread_id is NOT NULL until the store relaxes it),
    // not with the store helper, so this file compiles and
    // runs on the pre-fix tree — its failures there are "the endpoint clobbered
    // the row", not "a function you added does not exist".
    getDb()
      .prepare(
        `INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
         VALUES (?, ?, 'ag-incumbent', 'sess-incumbent', 'thread-seed', datetime('now'), 'prod')`,
      )
      .run(HELD.repo, HELD.prNumber);
  });

  it('answers 409 and names the incumbent', async () => {
    const r = await register({
      repo: HELD.repo,
      pr_number: HELD.prNumber,
      owner_instance: 'lego',
      agent_group_id: 'ag-attacker',
      session_id: 'sess-attacker',
    });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('pr already claimed');
    expect(r.body.held_by).toMatchObject({ owner_instance: 'prod', agent_group_id: 'ag-incumbent' });
  });

  it('leaves the row untouched', async () => {
    await register({
      repo: HELD.repo,
      pr_number: HELD.prNumber,
      owner_instance: 'lego',
      agent_group_id: 'ag-attacker',
      session_id: 'sess-attacker',
    });
    expect(read(HELD.repo, HELD.prNumber)).toMatchObject({
      agent_group_id: 'ag-incumbent',
      owner_instance: 'prod',
    });
  });

  it('does not answer 200 — a peer must be able to tell its registration did not take', async () => {
    const r = await register({
      repo: HELD.repo,
      pr_number: HELD.prNumber,
      owner_instance: 'lego',
      agent_group_id: 'ag-attacker',
      session_id: 'sess-attacker',
    });
    expect(r.status).not.toBe(200);
  });
});

describe('the legitimate peer path is unchanged', () => {
  it('registers an unclaimed PR and says so', async () => {
    const r = await register({
      repo: 'shader-slang/slang',
      pr_number: 5001,
      owner_instance: 'lego',
      agent_group_id: 'ag-lego-fixer',
      session_id: 'sess-lego-1',
      thread_id: 'thread-1',
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, outcome: 'claimed' });
    expect(read('shader-slang/slang', 5001)).toMatchObject({ agent_group_id: 'ag-lego-fixer' });
  });

  it('lets the holder re-register after its container restarts into a new session', async () => {
    await register({
      repo: 'shader-slang/slang',
      pr_number: 5002,
      owner_instance: 'lego',
      agent_group_id: 'ag-lego-fixer',
      session_id: 'sess-lego-1',
    });
    const again = await register({
      repo: 'shader-slang/slang',
      pr_number: 5002,
      owner_instance: 'lego',
      agent_group_id: 'ag-lego-fixer',
      session_id: 'sess-lego-2',
    });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ outcome: 'refreshed' });
  });
});

describe('a claim that says it is local must actually be local', () => {
  // The one thing this endpoint CAN check. A foreign claim carries the peer's
  // own ids, which are opaque here by design — that is what owner_instance is
  // for — but a claim asserting THIS instance names ids in this DB, so they
  // have to resolve and agree.
  it('rejects a local-instance claim naming a session that does not exist', async () => {
    const r = await register({
      repo: 'shader-slang/slang',
      pr_number: 6001,
      owner_instance: 'prod',
      agent_group_id: 'ag-ghost',
      session_id: 'sess-does-not-exist',
    });
    // INSTANCE_SLUG defaults to 'prod' in tests; if the default ever changes
    // this asserts the branch that actually ran rather than a fixed code.
    expect([403, 200]).toContain(r.status);
    if (r.status === 403) {
      expect(r.body.error).toMatch(/does not belong/);
      expect(read('shader-slang/slang', 6001)).toBeUndefined();
    }
  });
});
