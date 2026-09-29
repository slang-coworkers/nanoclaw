/**
 * A `kind: 'system'` outbound row that keeps taking the host down must not be
 * re-executed after every restart. Its START is counted in `delivery_attempts`
 * (a durable row, written before host code runs); once the count exceeds
 * MAX_SYSTEM_ACTION_STARTS the row is quarantined instead of run.
 *
 * Prod 2026-09-26: one `ncl sessions messages` request on a 2.6 GB session
 * OOM'd the host, replayed on every restart — 66 crashes, 15.9 h outage.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('./container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return {
    ...actual,
    DATA_DIR: '/tmp/nanoclaw-test-delivery-quarantine',
    GROUPS_DIR: '/tmp/nanoclaw-test-delivery-quarantine/groups',
  };
});

const TEST_DIR = '/tmp/nanoclaw-test-delivery-quarantine';

import { initTestDb, closeDb, runMigrations, createAgentGroup, createMessagingGroup } from './db/index.js';
import { getDeliveryAttempt, recordDeliveryAttempt } from './db/coordination.js';
import { unguarded } from './guard/index.js';
import { inboundDbPath, outboundDbPath } from './mailbox/sqlite/paths.js';
import { resolveSession } from './session-manager.js';
import {
  MAX_SYSTEM_ACTION_STARTS,
  deliverSessionMessages,
  registerDeliveryAction,
  setDeliveryAdapter,
} from './delivery.js';

const now = () => new Date().toISOString();

async function seedAgentAndChannel(): Promise<void> {
  await createAgentGroup({
    id: 'ag-1',
    name: 'Test Agent',
    folder: 'test-agent',
    agent_provider: null,
    created_at: now(),
  });
  await createMessagingGroup({
    id: 'mg-1',
    channel_type: 'telegram',
    platform_id: 'telegram:123',
    name: 'Test Chat',
    is_group: 0,
    unknown_sender_policy: 'public',
    created_at: now(),
  });
}

function insertSystemRow(
  agentGroupId: string,
  sessionId: string,
  msgId: string,
  content: Record<string, unknown>,
): void {
  const db = new Database(outboundDbPath(agentGroupId, sessionId));
  db.prepare(`INSERT INTO messages_out (id, timestamp, kind, content) VALUES (?, datetime('now'), 'system', ?)`).run(
    msgId,
    JSON.stringify(content),
  );
  db.close();
}

/** Starts recorded by previous process lives that never completed. */
async function seedPriorStarts(messageId: string, sessionId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await recordDeliveryAttempt({
      messageId,
      sessionId,
      now: now(),
      nextAttemptAt: null,
      error: 'started — no completion recorded',
    });
  }
}

function deliveredStatus(agentGroupId: string, sessionId: string, msgId: string): string | undefined {
  const db = new Database(inboundDbPath(agentGroupId, sessionId), { readonly: true });
  const row = db.prepare('SELECT status FROM delivered WHERE message_out_id = ?').get(msgId) as
    | { status: string }
    | undefined;
  db.close();
  return row?.status;
}

function inboundRow(agentGroupId: string, sessionId: string, id: string): { content: string } | undefined {
  const db = new Database(inboundDbPath(agentGroupId, sessionId), { readonly: true });
  const row = db.prepare('SELECT content FROM messages_in WHERE id = ?').get(id) as { content: string } | undefined;
  db.close();
  return row;
}

const handler = vi.fn();

beforeEach(async () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  const db = await initTestDb();
  await runMigrations(db);
  handler.mockReset().mockResolvedValue(undefined);
  setDeliveryAdapter({
    async deliver() {
      return undefined;
    },
  } as never);
});

afterEach(async () => {
  await closeDb();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

// One registration per action name for the whole file; the handler is a mock we reset.
registerDeliveryAction(
  'quarantine_probe',
  async (content, session) => handler(content, session),
  unguarded('test double'),
);

describe('system-action quarantine', () => {
  it('runs a system action normally and clears its start count on completion', async () => {
    await seedAgentAndChannel();
    const { session } = await resolveSession('ag-1', 'mg-1', null, 'shared');
    insertSystemRow('ag-1', session.id, 'sys-ok', { action: 'quarantine_probe' });
    await deliverSessionMessages(session);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(deliveredStatus('ag-1', session.id, 'sys-ok')).toBe('delivered');
    expect(await getDeliveryAttempt('sys-ok')).toBeUndefined();
  });

  it('gives a row whose previous start never completed one more chance', async () => {
    await seedAgentAndChannel();
    const { session } = await resolveSession('ag-1', 'mg-1', null, 'shared');
    insertSystemRow('ag-1', session.id, 'sys-retry', { action: 'quarantine_probe' });
    await seedPriorStarts('sys-retry', session.id, MAX_SYSTEM_ACTION_STARTS - 1);
    await deliverSessionMessages(session);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(deliveredStatus('ag-1', session.id, 'sys-retry')).toBe('delivered');
  });

  it('quarantines a row whose starts exceed MAX_SYSTEM_ACTION_STARTS without running it, and answers a cli_request', async () => {
    await seedAgentAndChannel();
    const { session } = await resolveSession('ag-1', 'mg-1', null, 'shared');
    insertSystemRow('ag-1', session.id, 'cli-poison', {
      action: 'cli_request',
      requestId: 'req-poison',
      command: 'sessions-messages-sess-huge',
      args: {},
    });
    await seedPriorStarts('cli-poison', session.id, MAX_SYSTEM_ACTION_STARTS);
    await deliverSessionMessages(session);
    // Never dispatched, marked failed so no later process life picks it up, attempt row gone.
    expect(handler).not.toHaveBeenCalled();
    expect(deliveredStatus('ag-1', session.id, 'cli-poison')).toBe('failed');
    expect(await getDeliveryAttempt('cli-poison')).toBeUndefined();
    // The agent's pending ncl call gets an error frame instead of a silent timeout.
    const resp = inboundRow('ag-1', session.id, 'cli-resp-req-poison');
    expect(resp).toBeDefined();
    const frame = JSON.parse(resp!.content) as {
      type: string;
      frame: { ok: boolean; error: { code: string; message: string } };
    };
    expect(frame.type).toBe('cli_response');
    expect(frame.frame.ok).toBe(false);
    expect(frame.frame.error.code).toBe('handler-error');
    expect(frame.frame.error.message).toMatch(/quarantined/);
    // A second drain does not touch it again.
    await deliverSessionMessages(session);
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not double-count a system action that throws (start already counted)', async () => {
    await seedAgentAndChannel();
    const { session } = await resolveSession('ag-1', 'mg-1', null, 'shared');
    insertSystemRow('ag-1', session.id, 'sys-throws', { action: 'quarantine_probe' });
    handler.mockRejectedValue(new Error('boom'));
    await deliverSessionMessages(session);
    expect((await getDeliveryAttempt('sys-throws'))?.attempts).toBe(1);
    await deliverSessionMessages(session);
    expect((await getDeliveryAttempt('sys-throws'))?.attempts).toBe(2);
  });
});
