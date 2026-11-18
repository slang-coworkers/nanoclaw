import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, getInboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { clearContinuation, getContinuation, setContinuation } from './db/session-state.js';

// Production providers and contracts (Claude's archiver among them), plus the
// mock that stands in for OpenCode as the provider the session now runs on.
await import('./providers/index.js');
await import('./provider-contracts/index.js');
const { MockProvider } = await import('./providers/mock.js');
const { runPollLoop } = await import('./poll-loop.js');

const CLAUDE_ID = '6ddf83a4-a3c8-42bb-a9b3-d74256deb095';
let tmp: string;
let conversationsDir: string;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'poll-loop-handoff-'));
  const projectDir = path.join(tmp, '.claude', 'projects', '-workspace-agent');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, `${CLAUDE_ID}.jsonl`),
    JSON.stringify({ type: 'user', timestamp: '2026-10-17T12:14:05Z', message: { content: 'Fix slang#13685' } }) + '\n',
  );
  conversationsDir = path.join(tmp, 'conversations');
  for (const key of ['HOME', 'CLAUDE_CONFIG_DIR', 'NANOCLAW_CONVERSATIONS_DIR']) savedEnv[key] = process.env[key];
  process.env.HOME = tmp;
  delete process.env.CLAUDE_CONFIG_DIR;
  process.env.NANOCLAW_CONVERSATIONS_DIR = conversationsDir;
  initTestSessionDb();
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES ('discord-test', 'Discord Test', 'channel', 'discord', 'chan-1', NULL)`,
    )
    .run();
});

afterEach(() => {
  closeSessionDb();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

function insertChat(id: string, text: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in (id, kind, timestamp, status, platform_id, channel_type, content)
       VALUES (?, 'chat', datetime('now'), 'pending', 'chan-1', 'discord', ?)`,
    )
    .run(id, JSON.stringify({ sender: 'Alice', text }));
}

async function waitFor(condition: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Run one container life: answer every message in `texts`, then stop. Returns the prompts the provider saw. */
async function runOneStart(texts: string[]): Promise<string[]> {
  const prompts: string[] = [];
  const provider = new MockProvider({}, (prompt) => {
    prompts.push(prompt);
    return `<message to="discord-test">reply ${prompts.length}</message>`;
  });
  const before = getUndeliveredMessages().length;
  const controller = new AbortController();
  const loop = runPollLoop({
    provider,
    providerName: 'opencode',
    cwd: '/workspace/agent',
    signal: controller.signal,
    activePollIntervalMs: 10,
  }).catch(() => {});
  try {
    for (const [index, text] of texts.entries()) {
      insertChat(`m-${Date.now()}-${index}`, text);
      await waitFor(() => getUndeliveredMessages().length >= before + index + 1, 3000);
    }
  } finally {
    controller.abort();
    await loop;
  }
  return prompts;
}

describe('poll loop — session that moved from Claude to another provider', () => {
  it('tells the first turn where the Claude conversation is archived, once across turns and starts', async () => {
    setContinuation('claude', CLAUDE_ID);

    const firstStart = await runOneStart(['are you there?', 'and now?']);

    expect(firstStart[0]).toContain('<system>This session ran on claude until');
    expect(firstStart[0]).toContain(`-claude-${CLAUDE_ID}.md`);
    expect(firstStart.slice(1).some((prompt) => prompt.includes('This session ran on claude'))).toBe(false);

    // Drop the new provider's own conversation too, so the next start would
    // run the handoff again: only the record of the delivered note stops it.
    clearContinuation('opencode');
    const secondStart = await runOneStart(['still there?']);

    expect(secondStart.some((prompt) => prompt.includes('This session ran on claude'))).toBe(false);
    expect(fs.readdirSync(conversationsDir).filter((file) => file.includes('-claude-'))).toHaveLength(1);
    expect(getContinuation('claude')).toBe(CLAUDE_ID);
  });
});
