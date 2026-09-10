/**
 * Tests for the core MCP tools' routing context: the a2a reply stamp and the
 * thread an outbound row is addressed to.
 *
 * The in_reply_to stamp is published through session_state in outbound.db, not
 * module state — the MCP server runs as a separate stdio subprocess from the
 * poll loop, so it can only see the stamp through the shared DB. These tests
 * seed it the same way the poll-loop process does (a direct DB write) rather
 * than via any in-memory helper, so they exercise the real process boundary.
 */
import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import fs from 'fs';

import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb, getOutboundDb } from '../mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from '../db/messages-out.js';
import { sendFile, sendMessage } from './core.js';

/**
 * Publish the reply stamp the way the poll loop does: a direct write to
 * session_state in outbound.db.
 */
function publishReplyRoute(
  route: { inReplyTo: string; channelType?: string | null; platformId?: string | null; threadId?: string | null },
  ageMs = 0,
): void {
  const updatedAt = new Date(Date.now() - ageMs).toISOString();
  getOutboundDb()
    .prepare('INSERT OR REPLACE INTO session_state (key, value, updated_at) VALUES (?, ?, ?)')
    .run(
      'current_reply_route',
      JSON.stringify({
        inReplyTo: route.inReplyTo,
        channelType: route.channelType ?? null,
        platformId: route.platformId ?? null,
        threadId: route.threadId ?? null,
      }),
      updatedAt,
    );
}

function publishInReplyTo(id: string, ageMs = 0): void {
  publishReplyRoute({ inReplyTo: id }, ageMs);
}

/** The session's bound chat/thread, as the host writes it on every wake. */
function seedBoundThread(channelType: string, platformId: string, threadId: string | null): void {
  const db = getInboundDb();
  db.exec(`CREATE TABLE IF NOT EXISTS session_routing (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    channel_type TEXT, platform_id TEXT, thread_id TEXT
  )`);
  db.prepare('INSERT INTO session_routing (id, channel_type, platform_id, thread_id) VALUES (1, ?, ?, ?)').run(
    channelType,
    platformId,
    threadId,
  );
}

function seedChannelDestination(name: string, channelType: string, platformId: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'channel', ?, ?, NULL)`,
    )
    .run(name, name, channelType, platformId);
}

let hostSeq = 0;

/**
 * An inbound row as the host routes it. `seq` steps by two because the host
 * owns even sequence numbers and the container odd ones — that parity is what
 * `getMessageIdBySeq` routes on, so an odd inbound row could never exist.
 */
function seedInbound(id: string, channelType: string, platformId: string, threadId: string | null): void {
  hostSeq += 2;
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, seq, kind, timestamp, status, platform_id, channel_type, thread_id, content)
       VALUES (?, ?, 'chat', ?, 'completed', ?, ?, ?, ?)`,
    )
    .run(
      id,
      hostSeq,
      new Date().toISOString(),
      platformId,
      channelType,
      threadId,
      JSON.stringify({ sender: 'Alice', text: 'hi' }),
    );
}

beforeEach(() => {
  initTestSessionDb();
  hostSeq = 0;
  // Seed a peer agent destination
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('peer', 'Peer', 'agent', NULL, NULL, 'ag-peer')`,
    )
    .run();
});

afterEach(() => {
  closeSessionDb();
});

describe('send_message MCP tool — in_reply_to plumbing', () => {
  it('stamps the batch in_reply_to (published via the DB) on outbound rows', async () => {
    publishInReplyTo('inbound-msg-1');

    await sendMessage.handler({ to: 'peer', text: 'hello' });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBe('inbound-msg-1');
  });

  it('writes null when no batch is active', async () => {
    // Nothing published to session_state — simulates ad-hoc / out-of-batch invocation.
    await sendMessage.handler({ to: 'peer', text: 'hello' });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBeNull();
  });

  it('honors a stamp of any age — a turn may run longer than any fixed limit (dead stamps are cleared at startup, see turn-routing.test.ts)', async () => {
    publishInReplyTo('inbound-msg-1', 3 * 60 * 60 * 1000); // three hours into the turn

    await sendMessage.handler({ to: 'peer', text: 'hello' });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBe('inbound-msg-1');
  });
});

describe('send_message / send_file — thread for a channel destination', () => {
  // send_file stages the file under /workspace/outbox, which only exists in a
  // container. Routing is what's under test, so stub the copy.
  let fsSpies: Array<{ mockRestore(): void }> = [];

  beforeEach(() => {
    seedChannelDestination('current-chat', 'slack', 'C123');
    fsSpies = [
      spyOn(fs, 'existsSync').mockReturnValue(true),
      spyOn(fs, 'mkdirSync').mockReturnValue(undefined),
      spyOn(fs, 'copyFileSync').mockReturnValue(undefined),
    ];
  });

  afterEach(() => {
    for (const spy of fsSpies) spy.mockRestore();
  });

  async function sendBoth(): Promise<Array<string | null>> {
    await sendMessage.handler({ to: 'current-chat', text: 'hello' });
    const file = (await sendFile.handler({ to: 'current-chat', path: '/tmp/report.txt' })) as { isError?: boolean };
    expect(file.isError).toBeUndefined();
    return getUndeliveredMessages().map((m) => m.thread_id);
  }

  it('replies in the thread of the message being answered, even when the session has no bound thread', async () => {
    // A shared / agent-shared session (or a DM sub-thread) is bound to the
    // channel with no thread of its own, but the request came in a thread.
    // The old code read the bound thread and sent the file to the top level.
    seedBoundThread('slack', 'C123', null);
    seedInbound('in-1', 'slack', 'C123', 'T-42');
    publishReplyRoute({ inReplyTo: 'in-1', channelType: 'slack', platformId: 'C123', threadId: 'T-42' });

    expect(await sendBoth()).toEqual(['T-42', 'T-42']);
  });

  it('keeps replying to the answered message when a newer message from another thread arrived mid-turn', async () => {
    seedInbound('in-1', 'slack', 'C123', 'T-1');
    seedInbound('in-2', 'slack', 'C123', 'T-42');
    publishReplyRoute({ inReplyTo: 'in-1', channelType: 'slack', platformId: 'C123', threadId: 'T-1' });

    expect(await sendBoth()).toEqual(['T-1', 'T-1']);
  });

  it("ignores the session's bound thread and falls back to the latest inbound thread out of a batch", async () => {
    seedBoundThread('slack', 'C123', 'T-bound');
    seedInbound('in-1', 'slack', 'C123', 'T-1');
    seedInbound('in-2', 'slack', 'C123', 'T-42');

    expect(await sendBoth()).toEqual(['T-42', 'T-42']);
  });

  it("uses the destination channel's own latest thread when answering a message from another channel", async () => {
    // agent-shared session: answering discord, sending to slack.
    seedInbound('in-0', 'slack', 'C123', 'T-9');
    seedInbound('in-1', 'discord', 'chan-9', 'discord-thread');
    publishReplyRoute({ inReplyTo: 'in-1', channelType: 'discord', platformId: 'chan-9', threadId: 'discord-thread' });

    expect(await sendBoth()).toEqual(['T-9', 'T-9']);
  });

  it('sends unthreaded to a channel nothing has arrived from', async () => {
    seedInbound('in-1', 'discord', 'chan-9', 'discord-thread');
    publishReplyRoute({ inReplyTo: 'in-1', channelType: 'discord', platformId: 'chan-9', threadId: 'discord-thread' });

    expect(await sendBoth()).toEqual([null, null]);
  });
});

function insertInbound(
  id: string,
  seq: number,
  fields: { thread_id?: string | null; channel_type?: string | null; platform_id?: string | null },
) {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, seq, kind, timestamp, status, content, thread_id, channel_type, platform_id)
       VALUES (?, ?, 'chat', ?, 'pending', ?, ?, ?, ?)`,
    )
    .run(
      id,
      seq,
      new Date().toISOString(),
      JSON.stringify({ text: '...' }),
      fields.thread_id ?? null,
      fields.channel_type ?? null,
      fields.platform_id ?? null,
    );
}

describe('send_message MCP tool — explicit in_reply_to arg', () => {
  it('rejects an in_reply_to that names no inbound row', async () => {
    const result = await sendMessage.handler({ to: 'peer', text: 'hi', in_reply_to: 999 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('no inbound message with that id');
  });

  it('rejects a non-integer in_reply_to', async () => {
    const result = await sendMessage.handler({ to: 'peer', text: 'hi', in_reply_to: 'abc' });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('integer id');
  });

  it('stamps the inbound id on the outbound and copies the inbound thread_id when no thread_id arg given', async () => {
    insertInbound('inbound-real-id', 120, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    await sendMessage.handler({ to: 'peer', text: 'reply', in_reply_to: 120 });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBe('inbound-real-id');
    expect(out[0].thread_id).toBe('slang-11144');
  });

  it('explicit thread_id arg wins over the inbound thread_id', async () => {
    insertInbound('inbound-real-id', 121, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    await sendMessage.handler({
      to: 'peer',
      text: 'reply',
      in_reply_to: 121,
      thread_id: 'override-thread',
    });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].thread_id).toBe('override-thread');
  });

  it("routes to the inbound's source destination when `to` is omitted", async () => {
    insertInbound('inbound-real-id', 122, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    await sendMessage.handler({ text: 'reply', in_reply_to: 122 });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].channel_type).toBe('agent');
    expect(out[0].platform_id).toBe('ag-peer');
    expect(out[0].thread_id).toBe('slang-11144');
    expect(out[0].in_reply_to).toBe('inbound-real-id');
  });

  it('explicit in_reply_to overrides current batch in_reply_to', async () => {
    publishInReplyTo('batch-default');
    insertInbound('inbound-explicit', 123, {
      thread_id: 'slangpy-807',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    await sendMessage.handler({ to: 'peer', text: 'reply', in_reply_to: 123 });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBe('inbound-explicit');
    expect(out[0].thread_id).toBe('slangpy-807');
  });
});

describe('send_message MCP tool — 3b peer-thread guard + autoResolveInReplyForPeerThread', () => {
  it('silently auto-resolves when exactly one unresponded peer inbound exists (no explicit in_reply_to)', async () => {
    // Peer talked to us once on slang-11144; we never originated, never replied.
    // Pre-fix: 3b guard rejected. Post-fix: 1 unresponded → silent auto-resolve.
    insertInbound('inbound-peer', 200, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendMessage.handler({
      to: 'peer',
      text: 'bare ack',
      thread_id: 'slang-11144',
    });
    expect(result.isError).toBeUndefined();
    // Single unresponded → no warning surfaced.
    expect((result.content[0] as { text: string }).text).not.toContain('auto-linked');
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('rejects with strict error when multiple unresponded peer inbounds exist (forces explicit in_reply_to)', async () => {
    // Two unresponded inbounds on the same peer thread — strict mode rejects
    // rather than auto-picking. The agent must specify in_reply_to=<seq>.
    insertInbound('inbound-peer-a', 200, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    insertInbound('inbound-peer-b', 202, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendMessage.handler({
      to: 'peer',
      text: 'bare ack',
      thread_id: 'slang-11144',
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('without in_reply_to');
    expect(text).toContain('2 unresponded inbound rows');
    expect(text).toContain('#200');
    expect(text).toContain('#202');
    // No outbound was sent (rejected before write).
    expect(getUndeliveredMessages()).toHaveLength(0);
  });

  it('explicit in_reply_to wins even when multiple unresponded inbounds exist', async () => {
    insertInbound('inbound-peer-a', 200, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    insertInbound('inbound-peer-b', 202, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendMessage.handler({
      to: 'peer',
      text: 'reply to older',
      in_reply_to: 200,
    });
    expect(result.isError).toBeUndefined();
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('falls through to guard rejection when all peer inbounds have been responded to', async () => {
    // Inbound at seq 200 already replied to via a prior outbound — auto-resolve
    // returns 0 candidates, guard rejects (the agent is on a stale thread).
    insertInbound('inbound-peer', 200, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    // First reply (consumes the inbound).
    await sendMessage.handler({
      to: 'peer',
      text: 'first reply',
      in_reply_to: 200,
    });

    // Now try a bare write on the same thread — no unresponded inbounds remain.
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'second bare ack',
      thread_id: 'slang-11144',
    });
    // hasOutboundToThread is now true (we already sent), so guard treats this
    // as continuation. Allowed without in_reply_to. Documenting expected
    // behavior under the new semantic.
    expect(result.isError).toBeUndefined();
  });

  it('allows bare a2a writes to a peer-owned thread when in_reply_to is set', async () => {
    insertInbound('inbound-peer', 201, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendMessage.handler({
      to: 'peer',
      text: 'linked reply',
      in_reply_to: 201,
    });
    expect(result.isError).toBeUndefined();
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('allows fresh dispatch on a brand-new thread (no prior inbound, no in_reply_to)', async () => {
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'kick off review-PR-A',
      thread_id: 'review-PR-A',
    });
    expect(result.isError).toBeUndefined();
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('allows continuation of a thread the session originated (prior outbound exists, no in_reply_to)', async () => {
    // First send establishes the thread (fresh dispatch).
    await sendMessage.handler({ to: 'peer', text: 'kick off', thread_id: 'review-PR-A' });
    expect(getUndeliveredMessages()).toHaveLength(1);

    // Peer replies, recorded as inbound on the same thread.
    insertInbound('inbound-peer-ack', 300, {
      thread_id: 'review-PR-A',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    // Bare follow-up auto-resolves to the unresponded peer reply (#300).
    // Pre-fix: hasOutboundToThread bypass let this through bare, mis-attaching.
    // Post-fix: candidates.length === 1 → silent auto-resolve to seq 300.
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'follow-up',
      thread_id: 'review-PR-A',
    });
    expect(result.isError).toBeUndefined();
    expect(getUndeliveredMessages()).toHaveLength(2);
  });

  it('rejects bare write on an originated thread when multiple unresponded peer replies pile up (A2A blind spot fix)', async () => {
    // Originated thread + 2 peer replies neither answered → ambiguous.
    // Pre-fix: hasOutboundToThread bypass returned ok blindly → silent
    // mis-attachment under multi-reply pressure.
    // Post-fix: strict-mode reject with candidate seqs in error.
    await sendMessage.handler({ to: 'peer', text: 'kick off', thread_id: 'review-PR-B' });
    insertInbound('inbound-peer-r1', 310, {
      thread_id: 'review-PR-B',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    insertInbound('inbound-peer-r2', 312, {
      thread_id: 'review-PR-B',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendMessage.handler({
      to: 'peer',
      text: 'bare follow-up',
      thread_id: 'review-PR-B',
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('without in_reply_to');
    expect(text).toContain('2 unresponded inbound rows');
    expect(text).toContain('#310');
    expect(text).toContain('#312');
    // Only the kickoff was sent; the bare follow-up was rejected.
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('does not block non-a2a writes (channel destinations)', async () => {
    // A channel destination, e.g. dashboard.
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('dashboard', 'Dashboard', 'channel', 'dashboard', 'dashboard:admin', NULL)`,
      )
      .run();
    insertInbound('inbound-dash', 400, {
      thread_id: 'msg-x',
      channel_type: 'dashboard',
      platform_id: 'dashboard:admin',
    });

    const result = await sendMessage.handler({
      to: 'dashboard',
      text: 'status update',
      thread_id: 'msg-x',
    });
    expect(result.isError).toBeUndefined();
  });
});

describe('send_file MCP tool — in_reply_to + 3b guard parity (validation paths)', () => {
  // sendFile's filesystem write requires `/workspace/outbox` which only
  // exists inside the agent container. These tests cover the validation
  // layer (in_reply_to resolution + 3b guard) that runs BEFORE the fs
  // write, so we can assert error-path parity with sendMessage without
  // needing a writable outbox.

  it('rejects an in_reply_to that names no inbound row', async () => {
    const result = await sendFile.handler({ to: 'peer', path: '/tmp/some.txt', in_reply_to: 999 });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('no inbound message with that id');
  });

  it('rejects a non-integer in_reply_to', async () => {
    const result = await sendFile.handler({ to: 'peer', path: '/tmp/some.txt', in_reply_to: 'abc' });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('integer id');
  });

  it('send_file: silently auto-resolves bare peer-thread write when exactly one unresponded inbound exists', async () => {
    // Single unresponded peer inbound — auto-resolve attaches it as in_reply_to,
    // guard passes, then fs check fires (using non-existent path here, so it
    // surfaces "File not found" — proving guard no longer rejects the write).
    insertInbound('inbound-peer-file', 500, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendFile.handler({
      to: 'peer',
      path: '/nonexistent.txt',
      thread_id: 'slang-11144',
    });
    // Guard passed (auto-resolved); fs check fails next.
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('File not found');
    expect((result.content[0] as { text: string }).text).not.toContain('without in_reply_to');
  });

  it('send_file: rejects with strict error when multiple unresponded peer inbounds exist', async () => {
    insertInbound('inbound-peer-file-a', 500, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    insertInbound('inbound-peer-file-b', 502, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    const result = await sendFile.handler({
      to: 'peer',
      path: '/nonexistent.txt',
      thread_id: 'slang-11144',
    });
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    // Auto-resolve rejects BEFORE fs check — error names candidate seqs.
    expect(text).toContain('2 unresponded inbound rows');
    expect(text).not.toContain('File not found');
  });

  it('send_file: falls through when all peer inbounds have been responded to (continuation)', async () => {
    insertInbound('inbound-peer-file-c', 510, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    // Reply once to consume the inbound + establish prior outbound.
    await sendMessage.handler({ to: 'peer', text: 'first reply', in_reply_to: 510 });

    const result = await sendFile.handler({
      to: 'peer',
      path: '/nonexistent.txt',
      thread_id: 'slang-11144',
    });
    // No unresponded candidates, prior outbound exists → guard treats as
    // continuation, fs check fires next.
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('File not found');
  });
});

/**
 * Gate-audit tests — soft enforcement that stage-passing markers
 * ([Fix Report], [Resolution]) only fire when the corresponding gate
 * (codex-critique, etc.) was actually invoked. The audit appends a warning
 * line to the tool response when a gate was skipped — the message still
 * sends (soft enforcement), but the skip is visible to upstream readers.
 */
describe('send_message MCP tool — gate audit', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-audit-test-'));
    process.env.NANOCLAW_SDK_JSONL_DIR = tmpDir;
  });

  afterEach(() => {
    delete process.env.NANOCLAW_SDK_JSONL_DIR;
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  function writeJsonl(entries: Array<Record<string, unknown>>): void {
    const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(path.join(tmpDir, 'session.jsonl'), lines);
  }

  it('no audit warning when message has no stage-passing marker', async () => {
    writeJsonl([]); // empty session
    const result = await sendMessage.handler({ to: 'peer', text: 'plain status update' });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).not.toContain('GATE AUDIT');
  });

  it('no audit warning when [Fix Report] is sent AND mcp__codex__codex was invoked', async () => {
    writeJsonl([
      {
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'mcp__codex__codex', input: { prompt: 'critique my fix' } }],
        },
      },
    ]);
    const result = await sendMessage.handler({
      to: 'peer',
      text: '[Fix Report] shader-slang/slang#11036 — fix delivered, tests pass',
    });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).not.toContain('GATE AUDIT');
  });

  it('audit warning appended when [Fix Report] sent without codex-critique evidence', async () => {
    writeJsonl([
      {
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'gh pr create' } }],
        },
      },
    ]);
    const result = await sendMessage.handler({
      to: 'peer',
      text: '[Fix Report] shader-slang/slang#11036 — fix delivered, tests pass',
    });
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('GATE AUDIT');
    expect(text).toContain('mcp__codex__codex');
    expect(text).toContain('gate skipped');
    // Message still sent (soft enforcement).
    expect(getUndeliveredMessages()).toHaveLength(1);
  });

  it('audit warning fires for [Resolution] markers as well', async () => {
    writeJsonl([]); // no codex calls
    const result = await sendMessage.handler({
      to: 'peer',
      text: '[Resolution] shader-slang/slang#11036 closed — finalised review',
    });
    expect(result.isError).toBeUndefined();
    expect((result.content[0] as { text: string }).text).toContain('GATE AUDIT');
  });
});

/**
 * Meta-ack audit tests — soft enforcement of the spine's [MUST] no
 * meta-acknowledgements rule. Pure peer-to-peer acks (no substantive
 * content) get a warning appended to the tool response. Channel
 * destinations (telegram/discord/dashboard) are exempt.
 */
describe('send_message MCP tool — meta-ack audit', () => {
  it('warns on bare "Acknowledged" peer-to-peer ack', async () => {
    insertInbound('inbound-peer-meta', 600, {
      thread_id: 'review-PR-meta',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'Acknowledged. Standing by.',
      in_reply_to: 600,
    });
    expect(result.isError).toBeUndefined();
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('META-ACK AUDIT');
    expect(text).toContain('no meta-acks');
  });

  it('warns on "Noted, will do." — short ack', async () => {
    insertInbound('inbound-peer-meta-2', 601, {
      thread_id: 'review-PR-meta',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'Noted, will do.',
      in_reply_to: 601,
    });
    expect((result.content[0] as { text: string }).text).toContain('META-ACK AUDIT');
  });

  it('does NOT warn on substantive message starting with "OK"', async () => {
    insertInbound('inbound-peer-meta-3', 602, {
      thread_id: 'review-PR-meta',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });
    // Long enough message — actual content beyond the OK opener.
    const long =
      'OK — pulled the diff for PR #11218. Three concrete edits needed in source/slang/slang-emit-spirv.cpp lines 4521-4537 and a new regression test under tests/raytracing/. Patch attached.';
    const result = await sendMessage.handler({
      to: 'peer',
      text: long,
      in_reply_to: 602,
    });
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('META-ACK AUDIT');
  });

  it('does NOT warn on channel destinations (user-facing acks have a role)', async () => {
    // Channel destination, not peer-to-peer → exempt from meta-ack rule.
    const result = await sendMessage.handler({
      to: 'dashboard',
      text: 'Acknowledged.',
    });
    expect((result.content[0] as { text: string }).text).not.toContain('META-ACK AUDIT');
  });
});
