import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb, getOutboundDb } from './db/connection.js';
import { getPendingMessages, markCompleted } from './db/messages-in.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { formatMessages, extractRouting } from './formatter.js';
import { checkCritiqueGate, dispatchResultText, isNewSessionBatch, taskOptsOutOfNewSession } from './poll-loop.js';
import { MockProvider } from './providers/mock.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function insertMessage(
  id: string,
  kind: string,
  content: object,
  opts?: { processAfter?: string; trigger?: 0 | 1; onWake?: 0 | 1 },
) {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, process_after, trigger, on_wake, content)
     VALUES (?, ?, datetime('now'), 'pending', ?, ?, ?, ?)`,
    )
    .run(id, kind, opts?.processAfter ?? null, opts?.trigger ?? 1, opts?.onWake ?? 0, JSON.stringify(content));
}

describe('formatter', () => {
  it('should format a single chat message', () => {
    insertMessage('m1', 'chat', { sender: 'John', text: 'Hello world' });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('sender="John"');
    expect(prompt).toContain('Hello world');
  });

  it('should format multiple chat messages as XML block', () => {
    insertMessage('m1', 'chat', { sender: 'John', text: 'Hello' });
    insertMessage('m2', 'chat', { sender: 'Jane', text: 'Hi there' });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('<messages>');
    expect(prompt).toContain('</messages>');
    expect(prompt).toContain('sender="John"');
    expect(prompt).toContain('sender="Jane"');
  });

  it('should format task messages', () => {
    insertMessage('m1', 'task', { prompt: 'Review open PRs' });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('<task');
    expect(prompt).toContain('Review open PRs');
  });

  it('should format webhook messages', () => {
    insertMessage('m1', 'webhook', { source: 'github', event: 'push', payload: { ref: 'main' } });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('<webhook');
    expect(prompt).toContain('source="github"');
    expect(prompt).toContain('event="push"');
  });

  it('should format system messages', () => {
    insertMessage('m1', 'system', { action: 'register_group', status: 'success', result: { id: 'ag-1' } });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('<system_response');
    expect(prompt).toContain('action="register_group"');
  });

  it('should handle mixed kinds', () => {
    insertMessage('m1', 'chat', { sender: 'John', text: 'Hello' });
    insertMessage('m2', 'system', { action: 'test', status: 'ok', result: null });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('sender="John"');
    expect(prompt).toContain('<system_response');
  });

  it('should escape XML in content', () => {
    insertMessage('m1', 'chat', { sender: 'A<B', text: 'x > y && z' });
    const messages = getPendingMessages();
    const prompt = formatMessages(messages);
    expect(prompt).toContain('A&lt;B');
    expect(prompt).toContain('x &gt; y &amp;&amp; z');
  });
});

describe('accumulate gate (trigger column)', () => {
  it('getPendingMessages returns both trigger=0 and trigger=1 rows', () => {
    // trigger=0 rides along as context, trigger=1 is the wake-eligible row.
    // The poll loop's gate depends on this data contract.
    insertMessage('m1', 'chat', { sender: 'A', text: 'chit chat' }, { trigger: 0 });
    insertMessage('m2', 'chat', { sender: 'B', text: 'actual mention' }, { trigger: 1 });
    const messages = getPendingMessages();
    expect(messages).toHaveLength(2);
    const byId = Object.fromEntries(messages.map((m) => [m.id, m]));
    expect(byId.m1.trigger).toBe(0);
    expect(byId.m2.trigger).toBe(1);
  });

  it('trigger=0-only batch: gate predicate `some(trigger===1)` is false', () => {
    insertMessage('m1', 'chat', { sender: 'A', text: 'noise' }, { trigger: 0 });
    insertMessage('m2', 'chat', { sender: 'B', text: 'more noise' }, { trigger: 0 });
    const messages = getPendingMessages();
    // This is the exact predicate the poll loop uses to skip accumulate-only
    // batches — gate should be false, so the loop sleeps without waking the agent.
    expect(messages.some((m) => m.trigger === 1)).toBe(false);
  });

  it('mixed batch: gate is true → loop proceeds, accumulated rows ride along', () => {
    insertMessage('m1', 'chat', { sender: 'A', text: 'earlier chatter' }, { trigger: 0 });
    insertMessage('m2', 'chat', { sender: 'B', text: 'the real mention' }, { trigger: 1 });
    const messages = getPendingMessages();
    expect(messages.some((m) => m.trigger === 1)).toBe(true);
    // Both messages are present for the formatter → agent sees the prior context.
    expect(messages.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('trigger column defaults to 1 for legacy inserts without explicit value', () => {
    // The schema default is 1 (see src/db/schema.ts INBOUND_SCHEMA) — existing
    // rows / tests without the column set are effectively wake-eligible.
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES ('m1', 'chat', datetime('now'), 'pending', '{"text":"hi"}')`,
      )
      .run();
    const [msg] = getPendingMessages();
    expect(msg.trigger).toBe(1);
  });
});

describe('on_wake filtering', () => {
  it('first poll returns on_wake=1 messages', () => {
    insertMessage('m1', 'chat', { sender: 'system', text: 'Resuming.' }, { onWake: 1 });
    const messages = getPendingMessages(true);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('m1');
  });

  it('subsequent polls skip on_wake=1 messages', () => {
    insertMessage('m1', 'chat', { sender: 'system', text: 'Resuming.' }, { onWake: 1 });
    const messages = getPendingMessages(false);
    expect(messages).toHaveLength(0);
  });

  it('normal messages returned regardless of isFirstPoll', () => {
    insertMessage('m1', 'chat', { sender: 'A', text: 'hello' });
    expect(getPendingMessages(true)).toHaveLength(1);

    // Reset: mark completed so we can re-test with a fresh message
    markCompleted(['m1']);
    insertMessage('m2', 'chat', { sender: 'A', text: 'hello again' });
    expect(getPendingMessages(false)).toHaveLength(1);
  });

  it('mixed batch: first poll returns both normal and on_wake messages', () => {
    insertMessage('m1', 'chat', { sender: 'A', text: 'user msg' });
    insertMessage('m2', 'chat', { sender: 'system', text: 'Resuming.' }, { onWake: 1 });
    const messages = getPendingMessages(true);
    expect(messages).toHaveLength(2);
    expect(messages.map((m) => m.id).sort()).toEqual(['m1', 'm2']);
  });

  it('mixed batch: subsequent poll returns only normal messages', () => {
    insertMessage('m1', 'chat', { sender: 'A', text: 'user msg' });
    insertMessage('m2', 'chat', { sender: 'system', text: 'Resuming.' }, { onWake: 1 });
    const messages = getPendingMessages(false);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('m1');
  });

  it('on_wake defaults to 0 for inserts without explicit value', () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, content)
         VALUES ('m1', 'chat', datetime('now'), 'pending', '{"text":"hi"}')`,
      )
      .run();
    // Should be returned even on non-first poll (on_wake=0)
    expect(getPendingMessages(false)).toHaveLength(1);
  });
});

describe('dispatchResultText auto-route gate', () => {
  // L1's job is to feed L2 a well-formed outbound row. These pin that
  // contract: agent channel emits with platformId=source-group; system
  // channel emits nothing. Same-session protection is exercised in the
  // host agent-route tests.

  it('agent channel: plain text auto-routes back to source platformId', () => {
    dispatchResultText('Verdict: approve_with_nits.', {
      platformId: 'ag-nanoclaw',
      channelType: 'agent',
      threadId: 'review-thread-1',
      inReplyTo: 'in-msg-1',
    });
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].channel_type).toBe('agent');
    expect(out[0].platform_id).toBe('ag-nanoclaw');
    expect(out[0].thread_id).toBe('review-thread-1');
    expect(out[0].in_reply_to).toBe('in-msg-1');
    expect(JSON.parse(out[0].content).text).toBe('Verdict: approve_with_nits.');
  });

  it('system channel: plain text is NOT auto-routed (scratchpad only)', () => {
    dispatchResultText('Saved learning.', {
      platformId: null,
      channelType: 'system',
      threadId: null,
      inReplyTo: 'sys-msg-1',
    });
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(0);
  });
});

describe('dispatchResultText <message> attribute parsing', () => {
  // The chain primitive lets agents emit <message to="X" thread_id="Y"
  // in_reply_to="Z">...</message> blocks. Earlier the regex only accepted
  // exactly `to=`, so any extra attribute pushed the entire markup to the
  // scratchpad path and the agent's output got dumped on the source
  // channel as raw text. These tests pin the new behavior:
  //   1. Bare `to=` keeps working (backward compat)
  //   2. thread_id / in_reply_to overrides win over destRouting fallback
  //   3. Unknown attributes are tolerated and ignored
  function addDestination(name: string) {
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES (?, ?, 'agent', NULL, NULL, ?)`,
      )
      .run(name, name, `ag-${name}`);
  }

  const sourceRouting = {
    platformId: 'ag-source',
    channelType: 'agent',
    threadId: 'src-thread',
    inReplyTo: 'src-msg',
  };

  it('bare <message to="X">…</message> still routes (backward compat)', () => {
    addDestination('peer');
    const result = dispatchResultText('<message to="peer">hello</message>', sourceRouting);
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].platform_id).toBe('ag-peer');
    expect(out[0].thread_id).toBe(null); // no agent-supplied thread_id, no destRouting history
    expect(JSON.parse(out[0].content).text).toBe('hello');
  });

  it('thread_id="X" overrides destRouting fallback', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer" thread_id="branch-A">hello</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out[0].thread_id).toBe('branch-A');
  });

  it('in_reply_to="X" overrides destRouting fallback', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer" in_reply_to="parent-msg-42">hello</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out[0].in_reply_to).toBe('parent-msg-42');
  });

  it('thread_id + in_reply_to + body all work together', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer" thread_id="thr-1" in_reply_to="m-7">payload</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out[0].thread_id).toBe('thr-1');
    expect(out[0].in_reply_to).toBe('m-7');
    expect(JSON.parse(out[0].content).text).toBe('payload');
  });

  it('unknown attributes are tolerated and ignored', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer" thread_id="T" foo="bar" priority="high">body</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out[0].thread_id).toBe('T'); // known attr still applied
    expect(JSON.parse(out[0].content).text).toBe('body');
  });

  it('two <message> blocks with different thread_ids route independently', () => {
    addDestination('peer-a');
    addDestination('peer-b');
    const result = dispatchResultText(
      '<message to="peer-a" thread_id="ta">A</message>\n<message to="peer-b" thread_id="tb">B</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(2);
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(2);
    const byDest = Object.fromEntries(out.map((r) => [r.platform_id, r]));
    expect(byDest['ag-peer-a'].thread_id).toBe('ta');
    expect(byDest['ag-peer-b'].thread_id).toBe('tb');
  });

  it('dangling <message to="X"> with no closing tag refuses delivery (triggers nudge)', () => {
    // A May 2026 incident: slang-fixer emitted `<message to="slang-reviewer">[Review Resume]…`
    // but never wrote `</message>`. The MESSAGE_RE skipped the block, the
    // single-destination/auto-route fallback dumped the entire half-finished
    // markup onto the inbound dashboard channel, and the intended peer
    // (slang-reviewer) never saw it. The fix: treat dangling-open as
    // undelivered so the existing nudge fires and the agent re-sends.
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer">half a message with no close tag and lots of body text',
      sourceRouting,
    );
    expect(result.sent).toBe(0);
    expect(result.hasUnwrapped).toBe(true);
    expect(result.danglingOpen).toBe(true);
    expect(getUndeliveredMessages()).toHaveLength(0);
  });

  it('dangling open does NOT trip when block is properly closed', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer">complete block</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    expect(result.danglingOpen).toBeFalsy();
  });

  it('dangling open with thread_id attribute still refuses', () => {
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer" thread_id="T">unfinished',
      sourceRouting,
    );
    expect(result.sent).toBe(0);
    expect(result.danglingOpen).toBe(true);
  });

  it('one closed + one dangling: closed dispatches; nudge does NOT fire (would double-deliver)', () => {
    // If we nudged here, the agent would re-emit the full response and the
    // already-delivered first block would land twice. Better: log the
    // dangling tail, let the workflow's "close every chain" rule recover.
    addDestination('peer-a');
    addDestination('peer-b');
    const result = dispatchResultText(
      '<message to="peer-a">first</message>\n<message to="peer-b">second, never closed',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    expect(result.danglingOpen).toBe(true);
    expect(result.hasUnwrapped).toBe(false); // sent>0 — nudge gated off
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].platform_id).toBe('ag-peer-a');
    expect(JSON.parse(out[0].content).text).toBe('first');
  });

  it('unknown destination drops the block, preserves attribute parsing path', () => {
    // Unknown name → block goes to scratchpad. With agent-channel source
    // routing, the scratchpad-fallback then auto-routes the dropped text
    // back to the source. We verify the chain-attribute parser didn't
    // crash on the unknown name (regression: the old code didn't even
    // recognize the block as a <message> tag because of the regex bug).
    const result = dispatchResultText(
      '<message to="nonexistent" thread_id="T">body</message>',
      sourceRouting,
    );
    // sent=1 from the scratchpad auto-route fallback (existing behavior),
    // not from a successful dispatch. The dropped block's body is in
    // the scratchpad payload routed back to source.
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(out[0].platform_id).toBe('ag-source');
    expect(JSON.parse(out[0].content).text).toContain('[dropped: unknown destination "nonexistent"]');
    expect(result.sent).toBe(1);
  });
});

describe('routing', () => {
  it('should extract routing from messages', () => {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, platform_id, channel_type, thread_id, content)
       VALUES ('m1', 'chat', datetime('now'), 'pending', 'chan-123', 'discord', 'thread-456', '{"text":"hi"}')`,
      )
      .run();

    const messages = getPendingMessages();
    const routing = extractRouting(messages);
    expect(routing.platformId).toBe('chan-123');
    expect(routing.channelType).toBe('discord');
    expect(routing.threadId).toBe('thread-456');
    expect(routing.inReplyTo).toBe('m1');
  });
});

describe('origin metadata (from= attribute)', () => {
  function seedDestination(name: string, channelType: string, platformId: string): void {
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES (?, ?, 'channel', ?, ?, NULL)`,
      )
      .run(name, name, channelType, platformId);
  }

  function insertWithRouting(id: string, kind: string, content: object, channelType: string | null, platformId: string | null): void {
    getInboundDb()
      .prepare(
        `INSERT INTO messages_in (id, kind, timestamp, status, platform_id, channel_type, content)
         VALUES (?, ?, datetime('now'), 'pending', ?, ?, ?)`,
      )
      .run(id, kind, platformId, channelType, JSON.stringify(content));
  }

  it('chat message includes from= when destination matches', () => {
    seedDestination('discord-main', 'discord', 'chan-1');
    insertWithRouting('m1', 'chat', { sender: 'Alice', text: 'hi' }, 'discord', 'chan-1');
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('from="discord-main"');
  });

  it('chat message falls back to raw routing when no destination matches', () => {
    insertWithRouting('m1', 'chat', { sender: 'Alice', text: 'hi' }, 'telegram', 'chat-999');
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('from="unknown:telegram:chat-999"');
  });

  it('chat message omits from= when routing is null', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' });
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).not.toContain('from=');
  });

  it('task message includes from= when destination matches', () => {
    seedDestination('slack-ops', 'slack', 'C-OPS');
    insertWithRouting('t1', 'task', { prompt: 'check status' }, 'slack', 'C-OPS');
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('<task');
    expect(prompt).toContain('from="slack-ops"');
  });

  it('task message omits from= when routing is null', () => {
    insertMessage('t1', 'task', { prompt: 'check status' });
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('<task');
    expect(prompt).not.toContain('from=');
  });

  it('webhook message includes from= when destination matches', () => {
    seedDestination('github-ch', 'github', 'repo-1');
    insertWithRouting('w1', 'webhook', { source: 'github', event: 'push', payload: {} }, 'github', 'repo-1');
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('<webhook');
    expect(prompt).toContain('from="github-ch"');
  });

  it('system message includes from= when destination matches', () => {
    seedDestination('discord-main', 'discord', 'chan-1');
    insertWithRouting('s1', 'system', { action: 'test', status: 'ok', result: null }, 'discord', 'chan-1');
    const prompt = formatMessages(getPendingMessages());
    expect(prompt).toContain('<system_response');
    expect(prompt).toContain('from="discord-main"');
  });
});

describe('mock provider', () => {
  it('should produce init + result events', async () => {
    const provider = new MockProvider({}, (prompt) => `Echo: ${prompt}`);
    const query = provider.query({
      prompt: 'Hello',
      cwd: '/tmp',
    });

    const events: Array<{ type: string }> = [];
    setTimeout(() => query.end(), 50);

    for await (const event of query.events) {
      events.push(event);
    }

    const typed = events.filter((e) => e.type !== 'activity');
    expect(typed.length).toBeGreaterThanOrEqual(2);
    expect(typed[0].type).toBe('init');
    expect(typed[1].type).toBe('result');
    expect((typed[1] as { text: string }).text).toBe('Echo: Hello');
  });

  it('should handle push() during active query', async () => {
    const provider = new MockProvider({}, (prompt) => `Re: ${prompt}`);
    const query = provider.query({
      prompt: 'First',
      cwd: '/tmp',
    });

    const events: Array<{ type: string; text?: string }> = [];

    setTimeout(() => query.push('Second'), 30);
    setTimeout(() => query.end(), 60);

    for await (const event of query.events) {
      events.push(event);
    }

    const results = events.filter((e) => e.type === 'result');
    expect(results).toHaveLength(2);
    expect(results[0].text).toBe('Re: First');
    expect(results[1].text).toBe('Re: Second');
  });
});

describe('end-to-end with mock provider', () => {
  it('should read messages_in, process with mock provider, write messages_out', async () => {
    // Insert a chat message into inbound DB
    insertMessage('m1', 'chat', { sender: 'User', text: 'What is 2+2?' });

    // Read and process
    const messages = getPendingMessages();
    expect(messages).toHaveLength(1);

    const routing = extractRouting(messages);
    const prompt = formatMessages(messages);

    // Create mock provider and run query
    const provider = new MockProvider({}, () => 'The answer is 4');
    const query = provider.query({
      prompt,
      cwd: '/tmp',
    });

    // Process events — simulate what poll-loop does
    const { markProcessing } = await import('./db/messages-in.js');
    const { writeMessageOut } = await import('./db/messages-out.js');

    markProcessing(['m1']);

    setTimeout(() => query.end(), 50);

    for await (const event of query.events) {
      if (event.type === 'result' && event.text) {
        writeMessageOut({
          id: `out-${Date.now()}`,
          in_reply_to: routing.inReplyTo,
          kind: 'chat',
          platform_id: routing.platformId,
          channel_type: routing.channelType,
          thread_id: routing.threadId,
          content: JSON.stringify({ text: event.text }),
        });
      }
    }

    markCompleted(['m1']);

    // Verify: message was processed (not pending, acked in processing_ack)
    const processed = getPendingMessages();
    expect(processed).toHaveLength(0);

    // Verify: response was written to outbound DB
    const outMessages = getUndeliveredMessages();
    expect(outMessages).toHaveLength(1);
    expect(JSON.parse(outMessages[0].content).text).toBe('The answer is 4');
    expect(outMessages[0].in_reply_to).toBe('m1');
  });
});

describe('new_session predicate (default-on: opt-out via new_session:false)', () => {
  // Post-default-on (PR #107): fresh session is the default for recurring
  // task batches. Only explicit `new_session: false` opts out. The shared
  // predicates (used by both the initial-batch gate and the mid-query
  // follow-up guard) pin the inverted semantics.

  const task = (content: object) => ({ kind: 'task', content: JSON.stringify(content) });
  const chat = (content: object) => ({ kind: 'chat', content: JSON.stringify(content) });

  it('taskOptsOutOfNewSession — true only for task kind with explicit new_session:false', () => {
    expect(taskOptsOutOfNewSession(task({ prompt: 'x', new_session: false }))).toBe(true);
    expect(taskOptsOutOfNewSession(task({ prompt: 'x' }))).toBe(false); // absent = default (not opt-out)
    expect(taskOptsOutOfNewSession(task({ prompt: 'x', new_session: true }))).toBe(false);
    expect(taskOptsOutOfNewSession(chat({ text: 'hi', new_session: false }))).toBe(false); // chat never participates
  });

  it('taskOptsOutOfNewSession — swallows malformed JSON instead of throwing', () => {
    expect(taskOptsOutOfNewSession({ kind: 'task', content: 'not-json' })).toBe(false);
    expect(taskOptsOutOfNewSession({ kind: 'task', content: '' })).toBe(false);
  });

  it('isNewSessionBatch — TRUE when every message is a task and none opts out (default-on)', () => {
    expect(isNewSessionBatch([task({ prompt: 'a' })])).toBe(true); // absent = default on
    expect(isNewSessionBatch([task({ prompt: 'a', new_session: true })])).toBe(true); // explicit true
    expect(isNewSessionBatch([task({ prompt: 'a' }), task({ prompt: 'b', new_session: true })])).toBe(true);
  });

  it('isNewSessionBatch — FALSE when any task opts out', () => {
    expect(isNewSessionBatch([task({ prompt: 'a', new_session: false })])).toBe(false);
    expect(isNewSessionBatch([task({ prompt: 'a' }), task({ prompt: 'b', new_session: false })])).toBe(false); // one opt-out blocks whole batch
  });

  it('isNewSessionBatch — FALSE on mixed batches (chat present preserves history)', () => {
    expect(isNewSessionBatch([chat({ text: 'hi' }), task({ prompt: 'a' })])).toBe(false);
    expect(isNewSessionBatch([chat({ text: 'hi' }), task({ prompt: 'a', new_session: true })])).toBe(false);
  });

  it('isNewSessionBatch — FALSE on empty batch (defensive: no spurious fresh sessions)', () => {
    expect(isNewSessionBatch([])).toBe(false);
  });
});

describe('checkCritiqueGate — text-output delivery-marker enforcement (#67)', () => {
  // The bash hook (gate-critique-on-deliver.sh) catches send_message and
  // gh-pr-create paths. This in-process check covers the text-output
  // <message to=>...</message> path that bypasses the bash hook entirely.
  // Logic must mirror the hook: same MARKER file, same workflow-state.json,
  // same delivery-marker regex.

  let tmp: string;
  let markerPath: string;
  let statePath: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-gate-test-'));
    markerPath = path.join(tmp, 'overlay-critique-gate');
    statePath = path.join(tmp, 'workflow-state.json');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('marker absent → not blocked (overlay opt-out)', () => {
    const r = checkCritiqueGate('[Fix Report] something', { overlayMarkerPath: markerPath, workflowStatePath: statePath });
    expect(r.blocked).toBe(false);
  });

  it('marker present + no delivery marker in body → not blocked', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    const r = checkCritiqueGate('Just a chat response, no delivery marker.', {
      overlayMarkerPath: markerPath,
      workflowStatePath: statePath,
    });
    expect(r.blocked).toBe(false);
  });

  it('marker present + [Fix Report] + critique_rounds=0 → BLOCKED', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
    const r = checkCritiqueGate('[Fix Report] all done', { overlayMarkerPath: markerPath, workflowStatePath: statePath });
    expect(r.blocked).toBe(true);
    expect(r.reason).toContain('critique_rounds=0');
    expect(r.reason).toContain('Fix Report');
  });

  it('marker present + [Fix Report] + missing state file → BLOCKED (treats as 0)', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    const r = checkCritiqueGate('[Fix Report] all done', { overlayMarkerPath: markerPath, workflowStatePath: statePath });
    expect(r.blocked).toBe(true);
  });

  it('marker present + [Fix Report] + critique_rounds=1 → not blocked', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 1 }));
    const r = checkCritiqueGate('[Fix Report] all done', { overlayMarkerPath: markerPath, workflowStatePath: statePath });
    expect(r.blocked).toBe(false);
  });

  it.each(['Fix Report', 'Resolution', 'Triage Resolution', 'Review Verdict', 'handoff'])(
    'recognizes [%s] as a delivery marker',
    (marker) => {
      fs.writeFileSync(markerPath, 'critique-gate\n');
      fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
      const r = checkCritiqueGate(`[${marker}] body`, { overlayMarkerPath: markerPath, workflowStatePath: statePath });
      expect(r.blocked).toBe(true);
    },
  );
});

describe('dispatchResultText — critique-gate text-output integration (#67)', () => {
  let tmp: string;
  let markerPath: string;
  let statePath: string;
  let originalOverlayCheck: string | undefined;

  function addDestination(name: string) {
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES (?, ?, 'agent', NULL, NULL, ?)`,
      )
      .run(name, name, `ag-${name}`);
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-dispatch-test-'));
    markerPath = path.join(tmp, '.overlay-critique-gate');
    statePath = path.join(tmp, 'workflow-state.json');
    // Override default paths via env so the in-process gate uses the
    // test temp dir instead of /workspace/agent and /workspace/.claude
    process.env.CRITIQUE_GATE_OVERLAY_PATH = markerPath;
    process.env.CRITIQUE_GATE_STATE_PATH = statePath;
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.CRITIQUE_GATE_OVERLAY_PATH;
    delete process.env.CRITIQUE_GATE_STATE_PATH;
  });

  const sourceRouting = {
    platformId: 'ag-source',
    channelType: 'agent',
    threadId: 'src-thread',
    inReplyTo: 'src-msg',
  };

  it('marker absent → [Fix Report] passes through unchanged (R1: no opt-in, no gating)', () => {
    addDestination('peer');
    const result = dispatchResultText('<message to="peer">[Fix Report] hello</message>', sourceRouting);
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0].content).text).toBe('[Fix Report] hello');
  });

  it('marker present + critique_rounds=0 → original [Fix Report] is REPLACED by refusal note', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
    addDestination('peer');
    const result = dispatchResultText(
      '<message to="peer">[Fix Report] all done — please ship</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(1);
    const text = JSON.parse(out[0].content).text;
    expect(text).toContain('[critique-gate] REFUSED');
    expect(text).toContain('Fix Report');
    expect(text).toContain('/codex-critique');
    expect(text).not.toContain('please ship'); // original body NOT delivered
  });

  it('marker present + critique_rounds=1 → original [Fix Report] passes through (gate satisfied)', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 1 }));
    addDestination('peer');
    const result = dispatchResultText('<message to="peer">[Fix Report] shipped</message>', sourceRouting);
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(JSON.parse(out[0].content).text).toBe('[Fix Report] shipped');
  });

  it('marker present + non-delivery body → passes through (only delivery markers are gated)', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
    addDestination('peer');
    const result = dispatchResultText('<message to="peer">just a regular reply</message>', sourceRouting);
    expect(result.sent).toBe(1);
    const out = getUndeliveredMessages();
    expect(JSON.parse(out[0].content).text).toBe('just a regular reply');
  });

  it('mixed batch: one [Fix Report] block + one normal block → first refused, second delivered', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
    addDestination('peer-a');
    addDestination('peer-b');
    const result = dispatchResultText(
      '<message to="peer-a">[Fix Report] blocked</message>\n<message to="peer-b">passes through</message>',
      sourceRouting,
    );
    expect(result.sent).toBe(2);
    const out = getUndeliveredMessages();
    expect(out).toHaveLength(2);
    const byDest = Object.fromEntries(out.map((r) => [r.platform_id, JSON.parse(r.content).text]));
    expect(byDest['ag-peer-a']).toContain('[critique-gate] REFUSED');
    expect(byDest['ag-peer-b']).toBe('passes through');
  });

  it('thread_id override is preserved even when the body is gate-replaced', () => {
    fs.writeFileSync(markerPath, 'critique-gate\n');
    fs.writeFileSync(statePath, JSON.stringify({ critique_rounds: 0 }));
    addDestination('peer');
    dispatchResultText(
      '<message to="peer" thread_id="branch-A">[Fix Report] body</message>',
      sourceRouting,
    );
    const out = getUndeliveredMessages();
    expect(out[0].thread_id).toBe('branch-A'); // refusal still flows on the agent's chosen thread
  });
});
