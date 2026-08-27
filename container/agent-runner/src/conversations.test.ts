import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { appendExchange, conversationsDir } from './conversations.js';

let tmp: string;
let prev: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-arch-'));
  prev = process.env.NANOCLAW_CONVERSATIONS_DIR;
  process.env.NANOCLAW_CONVERSATIONS_DIR = path.join(tmp, 'conversations');
});

afterEach(() => {
  if (prev === undefined) delete process.env.NANOCLAW_CONVERSATIONS_DIR;
  else process.env.NANOCLAW_CONVERSATIONS_DIR = prev;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function files(): string[] {
  try {
    return fs.readdirSync(conversationsDir()).sort();
  } catch {
    return [];
  }
}

describe('appendExchange', () => {
  it('creates the dated file with a heading and both speakers', () => {
    expect(appendExchange({ prompt: 'what is the status?', result: 'all green' })).toBe(true);

    const all = files();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatch(/^\d{4}-\d{2}-\d{2}-conversation\.md$/);

    const body = fs.readFileSync(path.join(conversationsDir(), all[0]!), 'utf-8');
    expect(body).toStartWith('# Conversation ');
    expect(body).toContain('**User**: what is the status?');
    expect(body).toContain('**Assistant**: all green');
  });

  // The whole point of appending: a chatty day must not yield a file per turn.
  it('appends a second exchange to the SAME file, with one heading', () => {
    appendExchange({ prompt: 'first', result: 'one' });
    appendExchange({ prompt: 'second', result: 'two' });

    expect(files()).toHaveLength(1);
    const body = fs.readFileSync(path.join(conversationsDir(), files()[0]!), 'utf-8');
    expect(body).toContain('first');
    expect(body).toContain('second');
    expect(body.match(/^# Conversation /gm) ?? []).toHaveLength(1);
  });

  it('uses the assistant name when given', () => {
    appendExchange({ prompt: 'hi', result: 'hello' }, { assistantName: 'Pixel' });
    const body = fs.readFileSync(path.join(conversationsDir(), files()[0]!), 'utf-8');
    expect(body).toContain('**Pixel**: hello');
    expect(body).not.toContain('**Assistant**:');
  });

  // A half-empty pair has nothing to recall; writing a stub would just add noise
  // the agent has to read past.
  it('skips when either side is empty or whitespace', () => {
    expect(appendExchange({ prompt: 'q', result: null })).toBe(false);
    expect(appendExchange({ prompt: '', result: 'a' })).toBe(false);
    expect(appendExchange({ prompt: '   ', result: '  ' })).toBe(false);
    expect(files()).toHaveLength(0);
  });

  it('clamps an oversized message instead of writing it whole', () => {
    appendExchange({ prompt: 'x'.repeat(5000), result: 'ok' });
    const body = fs.readFileSync(path.join(conversationsDir(), files()[0]!), 'utf-8');
    expect(body).toContain('...');
    expect(body.length).toBeLessThan(3000);
  });

  // container/CLAUDE.md tells the agent to split files over ~500 lines; the
  // writer enforces its own bound so an unattended group cannot grow one file
  // without limit.
  it('rolls to a -2 file once the current one is too long', () => {
    const dir = conversationsDir();
    fs.mkdirSync(dir, { recursive: true });
    // Seed today's file past the cap.
    const seeded = files();
    appendExchange({ prompt: 'seed', result: 'seed' });
    const first = files().find((f) => f.endsWith('-conversation.md'))!;
    fs.appendFileSync(path.join(dir, first), 'filler\n'.repeat(1300));
    expect(seeded).toHaveLength(0);

    appendExchange({ prompt: 'after roll', result: 'landed' });

    const rolled = files().find((f) => /-conversation-2\.md$/.test(f));
    expect(rolled).toBeTruthy();
    const body = fs.readFileSync(path.join(dir, rolled!), 'utf-8');
    expect(body).toStartWith('# Conversation ');
    expect(body).toContain('after roll');
  });

  // Archiving is a convenience, never a reason to fail a delivered turn.
  it('returns false and does not throw when the dir cannot be created', () => {
    const blocker = path.join(tmp, 'blocked');
    fs.writeFileSync(blocker, 'not a directory');
    process.env.NANOCLAW_CONVERSATIONS_DIR = blocker;

    const logged: string[] = [];
    expect(appendExchange({ prompt: 'q', result: 'a' }, { log: (m) => logged.push(m) })).toBe(false);
    expect(logged.join('\n')).toContain('Failed to append conversation archive');
  });

  it('honours NANOCLAW_CONVERSATIONS_DIR and defaults to the workspace path', () => {
    expect(conversationsDir()).toBe(path.join(tmp, 'conversations'));
    delete process.env.NANOCLAW_CONVERSATIONS_DIR;
    expect(conversationsDir()).toBe('/workspace/agent/conversations');
  });
});
