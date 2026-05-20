/**
 * v1-parity tests for formatter behavior.
 *
 * Port of src/v1/formatting.test.ts (at commit 27c5220, parent of the v1
 * deletion commit 86becf8). Covers: context timezone header, reply_to +
 * quoted_message rendering, XML escaping, and stripInternalTags.
 *
 * Timestamp-format assertions use `formatLocalTime()` output format, which
 * is host locale-dependent for decorators (month abbr, "," separator) but
 * stable for the numeric parts we assert on (hour, minute, year).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './db/connection.js';
import { getPendingMessages } from './db/messages-in.js';
import { formatMessages, stripInternalTags } from './formatter.js';
import { TIMEZONE } from './timezone.js';

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
  opts?: { timestamp?: string; thread_id?: string | null; channel_type?: string | null; platform_id?: string | null },
) {
  const timestamp = opts?.timestamp ?? new Date().toISOString();
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, content, thread_id, channel_type, platform_id)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`,
    )
    .run(
      id,
      kind,
      timestamp,
      JSON.stringify(content),
      opts?.thread_id ?? null,
      opts?.channel_type ?? null,
      opts?.platform_id ?? null,
    );
}

function setSessionThread(threadId: string | null) {
  const db = getInboundDb();
  db.exec(
    `CREATE TABLE IF NOT EXISTS session_routing (
       id           INTEGER PRIMARY KEY CHECK (id = 1),
       channel_type TEXT,
       platform_id  TEXT,
       thread_id    TEXT
     )`,
  );
  db.prepare(
    `INSERT OR REPLACE INTO session_routing (id, channel_type, platform_id, thread_id)
     VALUES (1, ?, ?, ?)`,
  ).run('dashboard', 'dashboard:admin', threadId);
}

describe('context timezone header', () => {
  it('prepends <context timezone="..."/> to formatted output', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hello' });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('includes the header even when the message list is empty', () => {
    const result = formatMessages([]);
    expect(result).toContain(`<context timezone="${TIMEZONE}"`);
  });

  it('header comes before the <messages> block', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'one' });
    insertMessage('m2', 'chat', { sender: 'Bob', text: 'two' });
    const result = formatMessages(getPendingMessages());
    const ctxIdx = result.indexOf('<context');
    const msgsIdx = result.indexOf('<messages>');
    expect(ctxIdx).toBeGreaterThanOrEqual(0);
    expect(msgsIdx).toBeGreaterThan(ctxIdx);
  });
});

describe('timestamp formatting', () => {
  it('renders time via formatLocalTime (user TZ)', () => {
    // 2026-06-15T12:00:00Z — timezone-agnostic assertions (year is stable)
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T12:00:00.000Z' });
    const result = formatMessages(getPendingMessages());
    // formatLocalTime's format in en-US contains the year and a month abbrev
    expect(result).toContain('2026');
    expect(result).toMatch(/Jun/);
  });

  it('uses 12-hour AM/PM format', () => {
    // 15:30 UTC — some hour will show with AM or PM depending on TZ
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'hi' }, { timestamp: '2026-06-15T15:30:00.000Z' });
    const result = formatMessages(getPendingMessages());
    expect(result).toMatch(/(AM|PM)/);
  });
});

describe('reply_to + quoted_message rendering', () => {
  it('renders reply_to attribute and quoted_message when all fields present', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'Yes, on my way!',
      replyTo: { id: '42', sender: 'Bob', text: 'Are you coming tonight?' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).toContain('<quoted_message from="Bob">Are you coming tonight?</quoted_message>');
    expect(result).toContain('Yes, on my way!</message>');
  });

  it('omits reply_to and quoted_message when no reply context', () => {
    insertMessage('m1', 'chat', { sender: 'Alice', text: 'plain' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('reply_to');
    expect(result).not.toContain('quoted_message');
  });

  it('renders reply_to but omits quoted_message when original content is missing', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'ack',
      replyTo: { id: '42', sender: 'Bob' }, // no text
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('reply_to="42"');
    expect(result).not.toContain('quoted_message');
  });

  it('XML-escapes reply context', () => {
    insertMessage('m1', 'chat', {
      sender: 'Alice',
      text: 'reply',
      replyTo: { id: '1', sender: 'A & B', text: '<script>alert("xss")</script>' },
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('from="A &amp; B"');
    expect(result).toContain('&lt;script&gt;');
    expect(result).toContain('&quot;xss&quot;');
  });
});

describe('thread="…" attribute (foreign-thread surfacing)', () => {
  it('emits thread="…" when an inbound row carries a thread_id different from the session', () => {
    setSessionThread('dashboard-thread-x');
    insertMessage(
      'm1',
      'chat',
      { sender: 'slang-triage', text: '[Triage] slang#11144' },
      { thread_id: 'slang-11144', channel_type: 'agent', platform_id: 'ag-triage' },
    );
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('thread="slang-11144"');
  });

  it('suppresses thread="…" when the inbound shares the session thread_id', () => {
    setSessionThread('dashboard-thread-x');
    insertMessage(
      'm1',
      'chat',
      { sender: 'admin', text: 'hi' },
      { thread_id: 'dashboard-thread-x', channel_type: 'dashboard', platform_id: 'dashboard:admin' },
    );
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('thread=');
  });

  it('suppresses thread="…" when inbound thread_id is null', () => {
    setSessionThread('dashboard-thread-x');
    insertMessage('m1', 'chat', { sender: 'admin', text: 'no thread' });
    const result = formatMessages(getPendingMessages());
    expect(result).not.toContain('thread=');
  });

  it('emits distinct thread="…" attributes for each inbound in a multi-thread batch', () => {
    setSessionThread(null);
    insertMessage(
      'm1',
      'chat',
      { sender: 'slang-triage', text: 'slang report' },
      { thread_id: 'slang-11144', channel_type: 'agent', platform_id: 'ag-slang-triage' },
    );
    insertMessage(
      'm2',
      'chat',
      { sender: 'slangy-triage', text: 'slangpy report' },
      { thread_id: 'slangpy-807', channel_type: 'agent', platform_id: 'ag-slangy-triage' },
    );
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('thread="slang-11144"');
    expect(result).toContain('thread="slangpy-807"');
  });

  it('escapes thread_id in the attribute', () => {
    setSessionThread('home');
    insertMessage(
      'm1',
      'chat',
      { sender: 'peer', text: 'msg' },
      { thread_id: 'a"b<c>&d', channel_type: 'agent', platform_id: 'ag-x' },
    );
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('thread="a&quot;b&lt;c&gt;&amp;d"');
  });
});

describe('XML escaping', () => {
  it('escapes <, >, &, " in sender and body', () => {
    insertMessage('m1', 'chat', {
      sender: 'A & B <Co>',
      text: '<script>alert("xss")</script>',
    });
    const result = formatMessages(getPendingMessages());
    expect(result).toContain('sender="A &amp; B &lt;Co&gt;"');
    expect(result).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});

describe('stripInternalTags', () => {
  it('strips single-line internal tags and trims', () => {
    expect(stripInternalTags('hello <internal>secret</internal> world')).toBe('hello  world');
  });

  it('strips multi-line internal tags', () => {
    expect(stripInternalTags('hello <internal>\nsecret\nstuff\n</internal> world')).toBe(
      'hello  world',
    );
  });

  it('strips multiple internal tag blocks', () => {
    expect(stripInternalTags('<internal>a</internal>hello<internal>b</internal>')).toBe('hello');
  });

  it('returns empty string when input is only internal tags', () => {
    expect(stripInternalTags('<internal>only this</internal>')).toBe('');
  });

  it('returns input unchanged when there are no internal tags', () => {
    expect(stripInternalTags('hello world')).toBe('hello world');
  });

  it('preserves content that surrounds internal tags', () => {
    expect(stripInternalTags('<internal>thinking</internal>The answer is 42')).toBe(
      'The answer is 42',
    );
  });
});
