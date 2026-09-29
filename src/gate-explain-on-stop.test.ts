// Integration tests for container/hooks/gate-explain-on-stop.sh.
//
// The Stop hook keeps the turn going while a PR this session created or pushed
// to has a description that explains an older head (or nothing). The receipts
// it reads are written by pr-auto-map.sh; these tests write them directly in the
// same shape (container/hooks/lib/explain-diff-owed.sh documents it).

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-explain-on-stop.sh');

let tmpRoot: string;
let overlayDir: string;
let receiptsFile: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-explain-stop-'));
  overlayDir = path.join(tmpRoot, 'overlay');
  fs.mkdirSync(overlayDir);
  fs.writeFileSync(path.join(overlayDir, '.overlay-critique-gate'), 'critique-gate\n');
  receiptsFile = path.join(tmpRoot, 'explain-diff-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function stop(input: object = { stop_hook_active: false }, env: Record<string, string> = {}) {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ hook_event_name: 'Stop', ...input }),
    env: {
      PATH: process.env.PATH || '',
      OVERLAY_MARKER_DIR: overlayDir,
      EXPLAIN_DIFF_STATE_FILE: receiptsFile,
      ...env,
    },
    encoding: 'utf-8',
  });
  const out = (proc.stdout ?? '').trim();
  return {
    status: proc.status ?? -1,
    decision: out ? (JSON.parse(out) as { decision?: string; reason?: string }) : null,
  };
}

const PR = 'shader-slang/slang#13213';
const created = { repo: 'shader-slang/slang', number: 13213, branch: 'fix/issue-13073', created_seq: 1 };
const push = (head: string, seq: number, branch = 'fix/issue-13073', repo = 'slang-coworkers/slang') => ({
  [`${repo}:${branch}`]: { repo, branch, head, pushed_at: '2026-09-29T10:00:00Z', seq },
});

function receipts(state: object): void {
  fs.writeFileSync(receiptsFile, JSON.stringify(state));
}

describe('gate-explain-on-stop.sh', () => {
  it('blocks when a created PR was never explained', () => {
    receipts({ seq: 1, prs: { [PR]: created } });
    const r = stop();
    expect(r.status).toBe(0);
    expect(r.decision?.decision).toBe('block');
    expect(r.decision?.reason).toContain(`opened ${PR}; its description still explains nothing`);
    expect(r.decision?.reason).toContain('upsert_pr_body.py');
  });

  it('blocks when a push is newer than the explanation, naming both heads', () => {
    receipts({
      seq: 3,
      prs: { [PR]: { ...created, explained_head: '555d69c0ffee', explained_seq: 2 } },
      pushes: push('9f8e7d6', 3),
    });
    const r = stop();
    expect(r.decision?.decision).toBe('block');
    expect(r.decision?.reason).toContain(`pushed 9f8e7d6 to ${PR}; its description still explains head 555d69c`);
  });

  it('passes when stop_hook_active is true (never loops the session)', () => {
    receipts({ seq: 1, prs: { [PR]: created } });
    const r = stop({ stop_hook_active: true });
    expect(r.status).toBe(0);
    expect(r.decision).toBeNull();
  });

  it('passes when the PR was explained after its last push', () => {
    receipts({
      seq: 3,
      prs: { [PR]: { ...created, explained_head: '9f8e7d6aaaaa', explained_seq: 3 } },
      pushes: push('9f8e7d6', 2),
    });
    expect(stop().decision).toBeNull();
  });

  it('a later push of the head already explained does not count (same head)', () => {
    receipts({
      seq: 3,
      prs: { [PR]: { ...created, explained_head: '9f8e7d6aaaaa', explained_seq: 2 } },
      pushes: push('9f8e7d6', 3),
    });
    expect(stop().decision).toBeNull();
  });

  it('a push to another branch of the repo does not count once the PR branch is known', () => {
    receipts({
      seq: 3,
      prs: { [PR]: { ...created, explained_head: '555d69c0ffee', explained_seq: 2 } },
      pushes: push('1234567', 3, 'fix/something-else'),
    });
    expect(stop().decision).toBeNull();
    // …but with the branch unknown, any push to the repo counts.
    receipts({
      seq: 3,
      prs: { [PR]: { ...created, branch: null, explained_head: '555d69c0ffee', explained_seq: 2 } },
      pushes: push('1234567', 3, 'fix/something-else'),
    });
    expect(stop().decision?.decision).toBe('block');
  });

  it('lists every PR that owes a refresh', () => {
    receipts({
      seq: 2,
      prs: { [PR]: created, 'o/r#1': { repo: 'o/r', number: 1, branch: null, created_seq: 2 } },
    });
    const reason = stop().decision?.reason ?? '';
    expect(reason).toContain(PR);
    expect(reason).toContain('o/r#1');
  });

  it('passes with no receipts file, or an unreadable one', () => {
    expect(stop().decision).toBeNull();
    fs.writeFileSync(receiptsFile, 'not json');
    expect(stop().status).toBe(0);
    expect(stop().decision).toBeNull();
  });

  it('is inactive when the critique gate is off, or EXPLAIN_DIFF_GATE=0', () => {
    receipts({ seq: 1, prs: { [PR]: created } });
    expect(stop({ stop_hook_active: false }, { CRITIQUE_GATE_ACTIVE: '0' }).decision).toBeNull();
    expect(stop({ stop_hook_active: false }, { EXPLAIN_DIFF_GATE: '0' }).decision).toBeNull();
    fs.rmSync(path.join(overlayDir, '.overlay-critique-gate'));
    expect(stop().decision).toBeNull();
    // The host-injected env var is authoritative over the (absent) marker.
    expect(stop({ stop_hook_active: false }, { CRITIQUE_GATE_ACTIVE: '1' }).decision?.decision).toBe('block');
  });
});
