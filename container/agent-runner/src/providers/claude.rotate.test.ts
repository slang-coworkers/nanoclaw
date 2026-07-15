import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ClaudeProvider } from './claude.js';

// maybeRotateContinuation guards the cold-resume failure mode: a long-lived
// session whose on-disk transcript has grown so large (or old) that the SDK
// can't reload it before the host's idle ceiling kills the container.

let tmp: string;
let prevHome: string | undefined;
let prevConv: string | undefined;
let prevBytes: string | undefined;
let prevDays: string | undefined;

const PROJECT_DIR = '-workspace-agent';
const CWD = '/workspace/agent';

function writeTranscript(sessionId: string, bytes: number, firstTs?: string): string {
  const dir = path.join(tmp, '.claude', 'projects', PROJECT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${sessionId}.jsonl`);
  const first =
    JSON.stringify({
      type: 'user',
      timestamp: firstTs ?? new Date().toISOString(),
      message: { role: 'user', content: 'hello' },
    }) + '\n';
  const filler = 'x'.repeat(Math.max(0, bytes - first.length));
  fs.writeFileSync(p, first + filler);
  return p;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rotate-'));
  prevHome = process.env.HOME;
  prevConv = process.env.NANOCLAW_CONVERSATIONS_DIR;
  prevBytes = process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES;
  prevDays = process.env.CLAUDE_TRANSCRIPT_ROTATE_AGE_DAYS;
  process.env.HOME = tmp;
  delete process.env.CLAUDE_CONFIG_DIR;
  process.env.NANOCLAW_CONVERSATIONS_DIR = path.join(tmp, 'conversations');
});

afterEach(() => {
  const restore = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  restore('HOME', prevHome);
  restore('NANOCLAW_CONVERSATIONS_DIR', prevConv);
  restore('CLAUDE_TRANSCRIPT_ROTATE_BYTES', prevBytes);
  restore('CLAUDE_TRANSCRIPT_ROTATE_AGE_DAYS', prevDays);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('ClaudeProvider.maybeRotateContinuation', () => {
  it('keeps a small, recent transcript (returns null, leaves file in place)', () => {
    process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES = String(1024 * 1024);
    const p = writeTranscript('sess-small', 4096);
    const provider = new ClaudeProvider();
    expect(provider.maybeRotateContinuation('sess-small', CWD)).toBeNull();
    expect(fs.existsSync(p)).toBe(true);
  });

  it('rotates an oversized transcript (returns reason, deletes the .jsonl after archiving)', () => {
    process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES = String(64 * 1024);
    const p = writeTranscript('sess-big', 200 * 1024);
    const provider = new ClaudeProvider();
    const reason = provider.maybeRotateContinuation('sess-big', CWD);
    expect(reason).toContain('MB');
    expect(fs.existsSync(p)).toBe(false); // original removed from the resume path
    const dir = path.dirname(p);
    // Disk is reclaimed: the raw .jsonl is deleted, not left behind as a .rotated- copy.
    expect(fs.readdirSync(dir).some((f) => f.startsWith('sess-big.jsonl.rotated-'))).toBe(false);
    // The readable summary is preserved in the conversations dir.
    const convDir = process.env.NANOCLAW_CONVERSATIONS_DIR as string;
    expect(fs.existsSync(convDir) && fs.readdirSync(convDir).some((f) => f.endsWith('.md'))).toBe(true);
  });

  it('keeps the raw transcript (renamed aside) when archiving fails', () => {
    process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES = String(64 * 1024);
    const p = writeTranscript('sess-noarchive', 200 * 1024);
    // Point the conversations dir at an existing *file* so mkdirSync (and thus
    // archiving) fails — the rotation must then fall back to renaming aside
    // rather than deleting unrecoverable history.
    const blocker = path.join(tmp, 'conv-blocker');
    fs.writeFileSync(blocker, 'x');
    // NANOCLAW_CONVERSATIONS_DIR is process-global and Bun runs test files
    // concurrently in one process. Pointing it at a file to force the failure
    // path must not leak into a sibling test's archive step (which would make
    // that test see EEXIST and fall to the rename branch). Scope the override
    // to just the call below, restoring the valid dir immediately after.
    const validConvDir = process.env.NANOCLAW_CONVERSATIONS_DIR;
    process.env.NANOCLAW_CONVERSATIONS_DIR = blocker;
    let reason: string | null;
    try {
      const provider = new ClaudeProvider();
      reason = provider.maybeRotateContinuation('sess-noarchive', CWD);
    } finally {
      if (validConvDir === undefined) delete process.env.NANOCLAW_CONVERSATIONS_DIR;
      else process.env.NANOCLAW_CONVERSATIONS_DIR = validConvDir;
    }
    expect(reason).toContain('MB');
    expect(fs.existsSync(p)).toBe(false);
    const dir = path.dirname(p);
    expect(fs.readdirSync(dir).some((f) => f.startsWith('sess-noarchive.jsonl.rotated-'))).toBe(true);
  });

  it('rotates an aged transcript even when small', () => {
    process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES = String(1024 * 1024);
    process.env.CLAUDE_TRANSCRIPT_ROTATE_AGE_DAYS = '7';
    const old = new Date(Date.now() - 10 * 86400_000).toISOString();
    writeTranscript('sess-old', 2048, old);
    const provider = new ClaudeProvider();
    expect(provider.maybeRotateContinuation('sess-old', CWD)).toContain('d');
  });

  it('returns null for an unknown session id', () => {
    const provider = new ClaudeProvider();
    expect(provider.maybeRotateContinuation('does-not-exist', CWD)).toBeNull();
  });
});
