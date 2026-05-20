/**
 * Tests for the core MCP tools' interaction with the per-batch routing
 * context. The agent-runner sets a current `inReplyTo` at the top of each
 * batch in poll-loop, and outbound writes from MCP tools (send_message,
 * send_file) must pick it up so a2a return-path routing on the host can
 * correlate replies back to the originating session.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb } from '../db/connection.js';
import { getUndeliveredMessages } from '../db/messages-out.js';
import { setCurrentInReplyTo, clearCurrentInReplyTo } from '../current-batch.js';
import { sendFile, sendMessage } from './core.js';

beforeEach(() => {
  initTestSessionDb();
  // Seed a peer agent destination
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('peer', 'Peer', 'agent', NULL, NULL, 'ag-peer')`,
    )
    .run();
});

afterEach(() => {
  clearCurrentInReplyTo();
  closeSessionDb();
});

describe('send_message MCP tool — in_reply_to plumbing', () => {
  it('stamps current batch in_reply_to on outbound rows', async () => {
    setCurrentInReplyTo('inbound-msg-1');

    await sendMessage.handler({ to: 'peer', text: 'hello' });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBe('inbound-msg-1');
  });

  it('writes null when no batch is active', async () => {
    // No setCurrentInReplyTo before this call — simulates ad-hoc / out-of-batch invocation.
    await sendMessage.handler({ to: 'peer', text: 'hello' });

    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].in_reply_to).toBeNull();
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

  it('routes to the inbound\'s source destination when `to` is omitted', async () => {
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
    setCurrentInReplyTo('batch-default');
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

describe('send_message MCP tool — 3b peer-thread guard', () => {
  it('rejects bare a2a writes to a peer-owned thread (no in_reply_to, no prior outbound)', async () => {
    // Peer talked to us on slang-11144; we never originated that thread.
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
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('without in_reply_to');
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

    // Peer replies, recorded as inbound on the same thread (this is the
    // shape that hasInboundFromThread sees).
    insertInbound('inbound-peer-ack', 300, {
      thread_id: 'review-PR-A',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    // Bare follow-up should still pass: we originated this thread.
    const result = await sendMessage.handler({
      to: 'peer',
      text: 'follow-up',
      thread_id: 'review-PR-A',
    });
    expect(result.isError).toBeUndefined();
    expect(getUndeliveredMessages()).toHaveLength(2);
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

  it('3b guard fires before the fs check: rejects bare a2a writes to peer-owned thread', async () => {
    // Inbound row from peer on slang-11144; we never originated.
    insertInbound('inbound-peer-file', 500, {
      thread_id: 'slang-11144',
      channel_type: 'agent',
      platform_id: 'ag-peer',
    });

    // Use a non-existent path; if the guard didn't fire first, we'd get
    // a "File not found" error instead of the in_reply_to-required hint.
    const result = await sendFile.handler({
      to: 'peer',
      path: '/nonexistent.txt',
      thread_id: 'slang-11144',
    });
    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('without in_reply_to');
  });
});
