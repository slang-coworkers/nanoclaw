/**
 * The two writers behave identically, asserted rather than assumed.
 *
 * `pr_session_mappings` has two agent-reachable writers — the `map_pr_session`
 * delivery action and the `/internal/register-pr` HTTP endpoint. A fix applied
 * to one leaves the other open, and the HTTP one is the easier to forget
 * because `INTERNAL_REGISTER_SECRET` makes it *look* protected. Signed means
 * "a peer sent this", not "this peer owns that PR".
 *
 * `register-endpoint.authz.test.ts` drives the HTTP path over a real socket.
 * This file drives the delivery action, and the last describe runs the same
 * takeover through both and compares the outcomes.
 */
import http from 'http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The delivery action skips registration entirely when INSTANCE_SLUG is unset,
// so set it before config.ts is imported or every assertion here reads as
// "the fix works" when in fact nothing ran.
process.env.INSTANCE_SLUG = 'prod';

const notified: { sessionId: string; text: string }[] = [];

vi.mock('../approvals/index.js', () => ({
  notifyAgent: (session: { id: string }, text: string) => {
    notified.push({ sessionId: session.id, text });
  },
}));

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

const { closeDb, getDb, initTestDb } = await import('../../db/connection.js');
const { runMigrations } = await import('../../db/migrations/index.js');
const { getDeliveryAction } = await import('../../delivery.js');
const { handleRegisterPr } = await import('./register-endpoint.js');
const { signRegisterBody, REGISTER_SIGNATURE_HEADER } = await import('./register-client.js');
await import('./index.js');

const HTTP_SECRET = 'parity-secret';
let httpServer: http.Server;
let httpUrl: string;

/** Drive the cross-instance endpoint for real and return its status code. */
async function registerOverHttp(payload: Record<string, unknown>): Promise<number> {
  const body = JSON.stringify(payload);
  const res = await fetch(httpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [REGISTER_SIGNATURE_HEADER]: signRegisterBody(HTTP_SECRET, body) },
    body,
  });
  await res.text();
  return res.status;
}

const REPO = 'shader-slang/slang';
const PR = 7777;

function session(id: string, agentGroupId: string): never {
  return { id, agent_group_id: agentGroupId, messaging_group_id: null, thread_id: null } as never;
}

async function reportPrCreated(sessionId: string, agentGroupId: string, prNumber = PR): Promise<void> {
  const handler = getDeliveryAction('map_pr_session');
  if (!handler) throw new Error('map_pr_session is not registered');
  await handler({ action: 'map_pr_session', repo: REPO, pr_number: prNumber }, session(sessionId, agentGroupId));
}

async function holder(prNumber = PR): Promise<{ agent_group_id: string; session_id: string } | undefined> {
  return getDb().get<{ agent_group_id: string; session_id: string }>(
    'SELECT agent_group_id, session_id FROM pr_session_mappings WHERE repo = ? AND pr_number = ?',
    REPO,
    prNumber,
  );
}

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = http.createServer((req, res) => void handleRegisterPr(req, res, HTTP_SECRET));
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') httpUrl = `http://127.0.0.1:${addr.port}/internal/register-pr`;
        resolve();
      });
    }),
);

afterAll(() => new Promise<void>((resolve) => httpServer.close(() => resolve())));

beforeEach(async () => {
  notified.length = 0;
  await runMigrations(await initTestDb());
});

afterEach(async () => {
  await closeDb();
});

describe('report_pr_created claims a PR for the calling session', () => {
  it('records the mapping when the PR is unclaimed', async () => {
    await reportPrCreated('sess-fixer', 'ag-fixer');
    expect(await holder()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer' });
  });

  it('lets the same group re-report from a new session after a restart', async () => {
    await reportPrCreated('sess-fixer-1', 'ag-fixer');
    await reportPrCreated('sess-fixer-2', 'ag-fixer');
    expect(await holder()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer-2' });
    expect(notified).toEqual([]);
  });
});

describe('a different group cannot capture a PR it does not hold', () => {
  beforeEach(async () => {
    await reportPrCreated('sess-fixer', 'ag-fixer');
    notified.length = 0;
  });

  it('leaves the mapping with the incumbent', async () => {
    await reportPrCreated('sess-attacker', 'ag-attacker');
    expect(await holder()).toMatchObject({ agent_group_id: 'ag-fixer', session_id: 'sess-fixer' });
  });

  it('tells the attacking agent instead of failing silently', async () => {
    await reportPrCreated('sess-attacker', 'ag-attacker');
    expect(notified).toHaveLength(1);
    expect(notified[0].sessionId).toBe('sess-attacker');
    expect(notified[0].text).toMatch(/already registered to another agent group/);
    // Actionable, not just "denied" — an agent told only "no" retries forever.
    expect(notified[0].text).toMatch(/ncl pr-mappings remap/);
  });

  it('does not claim an unrelated PR as a consolation prize', async () => {
    await reportPrCreated('sess-attacker', 'ag-attacker');
    expect(await holder(PR + 1)).toBeUndefined();
  });
});

describe('the MCP path and the HTTP path agree', () => {
  // The HTTP path's own end-to-end assertions live in
  // register-endpoint.authz.test.ts; this compares the OUTCOME of the same
  // takeover attempt through both writers, so the two cannot drift apart
  // without one of these going red.
  it('both refuse a foreign claim and both preserve the incumbent', async () => {
    // MCP path: claim, then a foreign group tries to take it.
    await reportPrCreated('sess-fixer', 'ag-fixer', 8001);
    await reportPrCreated('sess-attacker', 'ag-attacker', 8001);

    // HTTP path: same story, driven through the endpoint handler. Seeded with
    // raw SQL so this file needs no symbol the pre-fix tree lacks and its
    // failures there are behavioural.
    await getDb().run(
      `INSERT INTO pr_session_mappings (repo, pr_number, agent_group_id, session_id, thread_id, created_at, owner_instance)
         VALUES (?, 8002, 'ag-fixer', 'sess-fixer', 'thread-seed', datetime('now'), 'prod')`,
      REPO,
    );
    const httpStatus = await registerOverHttp({
      repo: REPO,
      pr_number: 8002,
      owner_instance: 'lego',
      agent_group_id: 'ag-attacker',
      session_id: 'sess-attacker',
    });

    const afterMcp = await holder(8001);
    const afterHttp = await holder(8002);

    expect(httpStatus).not.toBe(200);
    expect(afterMcp).toMatchObject({ agent_group_id: 'ag-fixer' });
    expect(afterHttp).toMatchObject({ agent_group_id: 'ag-fixer' });
    // The point of the file: one writer cannot be safe while the other is not.
    expect(afterMcp?.agent_group_id).toBe(afterHttp?.agent_group_id);
  });
});
