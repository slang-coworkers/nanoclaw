import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { ClaudeProvider } from './claude.js';

// Split out from claude.rotate.test.ts: this is the ONE rotation case that
// points the process-global NANOCLAW_CONVERSATIONS_DIR at a *file* to force
// archiving (mkdirSync) to fail. Keeping it in its own file guarantees the
// blocker value can never coexist — in the same test module / process window —
// with the success-path rotation tests, which expect archiving to SUCCEED and
// would otherwise intermittently see EEXIST and fall to the rename-aside branch
// under the full concurrent suite (the flake that reddened nv-nanoclaw CI).

let tmp: string;
let prevHome: string | undefined;
let prevConv: string | undefined;
let prevBytes: string | undefined;

const PROJECT_DIR = '-workspace-agent';
const CWD = '/workspace/agent';

function writeTranscript(sessionId: string, bytes: number): string {
  const dir = path.join(tmp, '.claude', 'projects', PROJECT_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${sessionId}.jsonl`);
  const first =
    JSON.stringify({
      type: 'user',
      timestamp: new Date().toISOString(),
      message: { role: 'user', content: 'hello' },
    }) + '\n';
  const filler = 'x'.repeat(Math.max(0, bytes - first.length));
  fs.writeFileSync(p, first + filler);
  return p;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-rotate-af-'));
  prevHome = process.env.HOME;
  prevConv = process.env.NANOCLAW_CONVERSATIONS_DIR;
  prevBytes = process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES;
  process.env.HOME = tmp;
  delete process.env.CLAUDE_CONFIG_DIR;
});

afterEach(() => {
  const restore = (k: string, v: string | undefined) => (v === undefined ? delete process.env[k] : (process.env[k] = v));
  restore('HOME', prevHome);
  restore('NANOCLAW_CONVERSATIONS_DIR', prevConv);
  restore('CLAUDE_TRANSCRIPT_ROTATE_BYTES', prevBytes);
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('ClaudeProvider.maybeRotateContinuation — archive failure', () => {
  it('keeps the raw transcript (renamed aside) when archiving fails', () => {
    process.env.CLAUDE_TRANSCRIPT_ROTATE_BYTES = String(64 * 1024);
    const p = writeTranscript('sess-noarchive', 200 * 1024);
    // Point the conversations dir at an existing *file* so mkdirSync (and thus
    // archiving) fails — the rotation must then fall back to renaming aside
    // rather than deleting unrecoverable history.
    const blocker = path.join(tmp, 'conv-blocker');
    fs.writeFileSync(blocker, 'x');
    process.env.NANOCLAW_CONVERSATIONS_DIR = blocker;
    const provider = new ClaudeProvider();
    const reason = provider.maybeRotateContinuation('sess-noarchive', CWD);
    expect(reason).toContain('MB');
    expect(fs.existsSync(p)).toBe(false);
    const dir = path.dirname(p);
    expect(fs.readdirSync(dir).some((f) => f.startsWith('sess-noarchive.jsonl.rotated-'))).toBe(true);
  });
});
