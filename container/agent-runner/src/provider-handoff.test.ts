import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { getContinuation, getProviderHandoff, setContinuation } from './db/session-state.js';
import { rotateClaudeContinuation } from './providers/claude-history.js';

// The barrels register every production provider and its runtime contract, so
// the handoff sees Claude's archiver exactly as the runner does.
await import('./providers/index.js');
await import('./provider-contracts/index.js');
const { markProviderHandoffNoted, prepareProviderHandoff } = await import('./provider-handoff.js');

// Consider a slang-fixer session that ran on Claude until 2026-10-30 and whose
// group now resolves to OpenCode: its next start has no OpenCode continuation.
const CLAUDE_ID = '6ddf83a4-a3c8-42bb-a9b3-d74256deb095';
const LAST_USED = '2026-10-30T04:00:00.273Z';

let tmp: string;
let projectDir: string;
let conversationsDir: string;
const logs: string[] = [];
const savedEnv: Record<string, string | undefined> = {};
const log = (line: string) => logs.push(line);

function writeTranscript(id: string, firstTimestamp = '2026-10-17T12:14:05.969Z'): string {
  const file = path.join(projectDir, `${id}.jsonl`);
  const lines = [
    {
      type: 'user',
      timestamp: firstTimestamp,
      message: { content: 'Fix slang#13685: E56004 on an undefined Texture2D' },
    },
    {
      type: 'assistant',
      timestamp: firstTimestamp,
      message: {
        content: [{ type: 'text', text: 'Peephole fold of all-undefined block params; skip self back-edges.' }],
      },
    },
  ];
  fs.writeFileSync(file, lines.map((line) => JSON.stringify(line)).join('\n') + '\n');
  return file;
}

function setContinuationAt(provider: string, id: string, updatedAt: string): void {
  setContinuation(provider, id);
  getOutboundDb()
    .prepare('UPDATE session_state SET updated_at = ? WHERE key = ?')
    .run(updatedAt, `continuation:${provider}`);
}

function archives(): string[] {
  return fs.existsSync(conversationsDir) ? fs.readdirSync(conversationsDir) : [];
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'provider-handoff-'));
  projectDir = path.join(tmp, '.claude', 'projects', '-workspace-agent');
  conversationsDir = path.join(tmp, 'conversations');
  fs.mkdirSync(projectDir, { recursive: true });
  for (const key of ['HOME', 'CLAUDE_CONFIG_DIR', 'NANOCLAW_CONVERSATIONS_DIR', 'CONTINUATION_ARCHIVE_MAX_BYTES']) {
    savedEnv[key] = process.env[key];
  }
  process.env.HOME = tmp;
  delete process.env.CLAUDE_CONFIG_DIR;
  delete process.env.CONTINUATION_ARCHIVE_MAX_BYTES;
  process.env.NANOCLAW_CONVERSATIONS_DIR = conversationsDir;
  logs.length = 0;
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('prepareProviderHandoff', () => {
  it('archives the Claude conversation once and notes it once when the session starts on OpenCode', () => {
    const transcript = writeTranscript(CLAUDE_ID);
    setContinuationAt('claude', CLAUDE_ID, LAST_USED);

    const pending = prepareProviderHandoff({ currentProvider: 'opencode', log });

    expect(pending).not.toBeNull();
    const archived = archives();
    expect(archived).toHaveLength(1);
    expect(archived[0]).toEndWith(`-claude-${CLAUDE_ID}.md`);
    const archivePath = path.join(conversationsDir, archived[0]);
    expect(fs.readFileSync(archivePath, 'utf-8')).toContain('Peephole fold of all-undefined block params');
    expect(pending!.note).toContain('This session ran on claude until 2026-10-30.');
    expect(pending!.note).toContain('the session now runs on opencode');
    expect(pending!.note).toContain(`It is archived at ${archivePath}`);
    // The Claude conversation stays resumable: a switch back still finds it.
    expect(getContinuation('claude')).toBe(CLAUDE_ID);
    expect(fs.existsSync(transcript)).toBe(true);

    markProviderHandoffNoted(pending!);
    expect(prepareProviderHandoff({ currentProvider: 'opencode', log })).toBeNull();
    expect(archives()).toHaveLength(1);
  });

  it('repeats the note without archiving again when the first turn never completed', () => {
    writeTranscript(CLAUDE_ID);
    setContinuationAt('claude', CLAUDE_ID, LAST_USED);
    const first = prepareProviderHandoff({ currentProvider: 'opencode', log })!;
    const archivePath = path.join(conversationsDir, archives()[0]);
    fs.writeFileSync(archivePath, 'unchanged');

    // The container died before a turn took the note: the next start notes it
    // again from the stored record, without rewriting the archive.
    const second = prepareProviderHandoff({ currentProvider: 'opencode', log })!;

    expect(second.note).toBe(first.note);
    expect(fs.readFileSync(archivePath, 'utf-8')).toBe('unchanged');
    expect(getProviderHandoff('claude', CLAUDE_ID)).toEqual({ path: archivePath, lastUsedAt: LAST_USED, noted: false });
  });

  it('does nothing when no other provider holds a conversation', () => {
    expect(prepareProviderHandoff({ currentProvider: 'opencode', log })).toBeNull();
    expect(archives()).toEqual([]);
  });

  it('notes a conversation whose transcript is gone, without a path', () => {
    setContinuationAt('claude', CLAUDE_ID, LAST_USED);

    const pending = prepareProviderHandoff({ currentProvider: 'opencode', log })!;

    expect(pending.note).toContain('This session ran on claude until 2026-10-30.');
    expect(pending.note).toContain('No readable copy of it exists');
    expect(pending.note).not.toContain('archived at');
    expect(archives()).toEqual([]);
    expect(getProviderHandoff('claude', CLAUDE_ID)?.path).toBeNull();
  });

  it('notes a provider that declares no archiver, such as OpenCode, without a path', () => {
    setContinuationAt('opencode', 'ses_e268', '2026-11-14T08:00:00.000Z');

    const pending = prepareProviderHandoff({ currentProvider: 'claude', log })!;

    expect(pending.note).toContain('This session ran on opencode until 2026-11-14.');
    expect(pending.note).toContain('No readable copy of it exists');
  });

  it('leaves a transcript over the size limit unconverted and says so in the log', () => {
    writeTranscript(CLAUDE_ID);
    setContinuationAt('claude', CLAUDE_ID, LAST_USED);
    process.env.CONTINUATION_ARCHIVE_MAX_BYTES = '16';

    const pending = prepareProviderHandoff({ currentProvider: 'opencode', log })!;

    expect(archives()).toEqual([]);
    expect(pending.note).toContain('No readable copy of it exists');
    expect(logs.some((line) => line.includes('over the 0MB archive limit'))).toBe(true);
  });

  it('does not archive again a conversation that rotation already archived', () => {
    // The session runs on Claude, whose own transcript is past the age limit:
    // rotation archives and removes it, and the session starts fresh. It also
    // holds an OpenCode conversation from an earlier run.
    const oldId = '11111111-2222-4333-8444-555555555555';
    writeTranscript(oldId, '2026-09-01T00:00:00.000Z');
    setContinuationAt('claude', oldId, '2026-09-20T00:00:00.000Z');
    setContinuationAt('opencode', 'ses_e268', '2026-11-14T08:00:00.000Z');
    expect(
      rotateClaudeContinuation({ continuation: oldId, log }, { now: () => Date.parse('2026-11-17T00:00:00Z') }),
    ).toContain('d old');
    expect(archives()).toHaveLength(1);

    const pending = prepareProviderHandoff({ currentProvider: 'claude', log })!;

    // Only the other provider's conversation is handed off; Claude's own,
    // already archived by rotation, is not archived a second time.
    expect(pending.entries.map((entry) => entry.provider)).toEqual(['opencode']);
    expect(archives()).toHaveLength(1);
  });
});
