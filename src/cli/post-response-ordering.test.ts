/**
 * A command that restarts containers must not destroy its own answer.
 *
 * `ncl groups mcp-tools set` kills every running container in the target
 * group. When the caller IS one of those containers, the ordering matters
 * absolutely: the response frame for a container-issued `cli_request` is
 * written to that session's inbound.db only AFTER `dispatch()` returns, so a
 * kill performed inside the handler leaves the caller dead before its answer
 * lands. The operator sees a command that hung, with no way to tell whether
 * the narrowing took effect.
 *
 * Handlers therefore queue such effects (`enqueuePostResponseEffect`) and each
 * transport drains only once its response is durable. This exercises the real
 * `cli_request` delivery action end to end and asserts that the response row
 * is already readable at the moment the effect runs.
 */
import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../config.js', async () => {
  const actual = await vi.importActual('../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-post-response' };
});

const TEST_DIR = '/tmp/nanoclaw-test-post-response';

const { initTestDb, closeDb, runMigrations, createAgentGroup } = await import('../db/index.js');
const { createSession } = await import('../db/sessions.js');
const { getDeliveryAction } = await import('../delivery.js');
const { initSessionFolder, openInboundDb } = await import('../session-manager.js');
const { register } = await import('./registry.js');
const { enqueuePostResponseEffect, resetPostResponseEffectsForTests } = await import('./post-response.js');
await import('./delivery-action.js');

const GID = 'ag-caller';
const SID = 'sess-caller';

/** Rows visible in the caller's inbound.db at the moment the effect fired. */
let seenAtEffectTime: string[] | null = null;

register({
  name: 'test-restarting-command',
  description: 'test-only: queues a post-response effect the way mcp-tools set does',
  access: 'open',
  parseArgs: (raw) => raw,
  handler: async () => {
    enqueuePostResponseEffect('test-effect', () => {
      const db = openInboundDb(GID, SID);
      seenAtEffectTime = (db.prepare('SELECT id FROM messages_in').all() as { id: string }[]).map((r) => r.id);
    });
    return { queued: true };
  },
});

function now(): string {
  return new Date().toISOString();
}

beforeEach(() => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'v2-sessions', GID, SID), { recursive: true });
  seenAtEffectTime = null;
  initSessionFolder(GID, SID);
  resetPostResponseEffectsForTests();

  runMigrations(initTestDb());
  createAgentGroup({ id: GID, name: 'Caller', folder: 'caller', agent_provider: null, created_at: now() });
  createSession({
    id: SID,
    agent_group_id: GID,
    messaging_group_id: null,
    thread_id: null,
    agent_provider: null,
    status: 'active',
    container_status: 'running',
    last_active: null,
    created_at: now(),
  });
});

afterEach(() => {
  closeDb();
  resetPostResponseEffectsForTests();
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
});

describe('post-response effects run strictly after the response is durable', () => {
  it('the cli_response row is already in inbound.db when the effect fires', async () => {
    const inDb = openInboundDb(GID, SID);
    const handler = getDeliveryAction('cli_request')!;
    const session = { id: SID, agent_group_id: GID, messaging_group_id: null } as never;

    await handler(
      { action: 'cli_request', requestId: 'req-42', command: 'test-restarting-command', args: {} },
      session,
      inDb,
    );

    expect(seenAtEffectTime).not.toBeNull();
    expect(seenAtEffectTime).toContain('cli-resp-req-42');

    // And the answer really is the handler's, not an error.
    const row = inDb.prepare('SELECT content FROM messages_in WHERE id = ?').get('cli-resp-req-42') as {
      content: string;
    };
    const frame = JSON.parse(row.content).frame as { ok: boolean; data: { queued: boolean } };
    expect(frame.ok).toBe(true);
    expect(frame.data.queued).toBe(true);
  });

  it('does not run the effect inline, before the response exists', async () => {
    const inDb = openInboundDb(GID, SID);
    // Calling the command's handler directly (no transport) must leave the
    // effect queued — proving the handler defers rather than acting.
    const { dispatch } = await import('./dispatch.js');
    await dispatch({ id: 'req-43', command: 'test-restarting-command', args: {} }, { caller: 'host' });
    expect(seenAtEffectTime).toBeNull();
    expect((inDb.prepare('SELECT count(*) c FROM messages_in').get() as { c: number }).c).toBe(0);
  });
});
