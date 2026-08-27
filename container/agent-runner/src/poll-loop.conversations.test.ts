/**
 * The archive is written by the poll loop, so every provider gets it — not by a
 * provider implementing the optional `onExchangeComplete` hook (which none of
 * the five do). These cases drive the real `processQuery` so the wiring, the
 * status filter and the task gate are covered together rather than mocked.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './mailbox/sqlite/connection.js';
import { processQuery } from './poll-loop.js';
import type { AgentQuery, ProviderEvent } from './providers/types.js';

let tmp: string;
let prevConv: string | undefined;
let prevName: string | undefined;
let seq = 1;

const chatRouting = {
  platformId: 'dashboard:admin',
  channelType: 'dashboard' as const,
  threadId: null,
  inReplyTo: undefined,
  taskRun: false,
};

/** Minimal driver: one init + one result event, then end. */
function query(text: string, isError = false): AgentQuery {
  const events: AsyncIterable<ProviderEvent> = {
    async *[Symbol.asyncIterator]() {
      yield { type: 'init', continuation: 'sess-conv' } as ProviderEvent;
      yield { type: 'result', text, isError } as ProviderEvent;
    },
  };
  return { push() {}, end() {}, abort() {}, events };
}

function insert(id: string, kind: string, content: object) {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, content, seq)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(id, kind, new Date().toISOString(), JSON.stringify(content), seq++);
}

function archived(): string[] {
  try {
    return fs.readdirSync(path.join(tmp, 'conversations')).sort();
  } catch {
    return [];
  }
}

function archivedText(): string {
  return archived()
    .map((f) => fs.readFileSync(path.join(tmp, 'conversations', f), 'utf-8'))
    .join('\n');
}

beforeEach(() => {
  initTestSessionDb();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-conv-'));
  prevConv = process.env.NANOCLAW_CONVERSATIONS_DIR;
  prevName = process.env.NANOCLAW_ASSISTANT_NAME;
  process.env.NANOCLAW_CONVERSATIONS_DIR = path.join(tmp, 'conversations');
});

afterEach(() => {
  closeSessionDb();
  const restore = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  restore('NANOCLAW_CONVERSATIONS_DIR', prevConv);
  restore('NANOCLAW_ASSISTANT_NAME', prevName);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('conversation archiving is provider-neutral', () => {
  // 'mock' is not the claude provider and implements no onExchangeComplete —
  // the archive must appear anyway. That is the whole point of the change.
  it('archives a delivered turn for a provider that implements no hook', async () => {
    insert('c1', 'chat', { sender: 'admin', text: 'what is 2+2?' });
    process.env.NANOCLAW_ASSISTANT_NAME = 'Pixel';

    await processQuery(query('The answer is 4'), chatRouting, ['c1'], 'mock', undefined, 'what is 2+2?');

    expect(archived()).toHaveLength(1);
    const body = archivedText();
    expect(body).toContain('The answer is 4');
    expect(body).toContain('**Pixel**:');
  });

  // An error result is text the user never received; archiving it would let the
  // agent "recall" something that never happened.
  it('does NOT archive an error turn', async () => {
    insert('c2', 'chat', { sender: 'admin', text: 'do the thing' });

    await processQuery(
      query('Error: 403 billing_error: credit balance too low', true),
      chatRouting,
      ['c2'],
      'mock',
      undefined,
      'do the thing',
    );

    expect(archived()).toHaveLength(0);
  });

  // Task runs already get tasks/<id>.md; a second copy here is duplication.
  it('does NOT archive a task run', async () => {
    insert('t1', 'task', { prompt: 'daily digest' });

    await processQuery(query('digest sent'), { ...chatRouting, taskRun: true }, ['t1'], 'mock', undefined, 'daily digest');

    expect(archived()).toHaveLength(0);
  });

  // `processQuery`'s `initialPrompt` defaults to '' and internal callers rely on
  // that default. An entry with no question is not a conversation, so the writer
  // skips the pair rather than recording a one-sided stub.
  it('does NOT archive when no prompt was threaded through', async () => {
    insert('c5', 'chat', { sender: 'admin', text: 'ignored' });

    await processQuery(query('an answer to nothing'), chatRouting, ['c5'], 'mock');

    expect(archived()).toHaveLength(0);
  });

  // Two turns in a day must land in one file, not two.
  it('appends successive turns to a single dated file', async () => {
    insert('c3', 'chat', { sender: 'admin', text: 'first question' });
    await processQuery(query('first answer'), chatRouting, ['c3'], 'mock', undefined, 'first question');
    insert('c4', 'chat', { sender: 'admin', text: 'second question' });
    await processQuery(query('second answer'), chatRouting, ['c4'], 'mock', undefined, 'second question');

    expect(archived()).toHaveLength(1);
    const body = archivedText();
    expect(body).toContain('first answer');
    expect(body).toContain('second answer');
  });
});
