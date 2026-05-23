// Integration tests for container/hooks/spawn-buddy.sh + buddy-inject.sh.
//
// spawn-buddy is the PostToolUse opt-in gate that fires buddy-call.sh
// asynchronously. Under Model A symmetric opt-in, it first-line checks for
// /workspace/agent/.overlay-buddy-monitor (path overridable via
// OVERLAY_MARKER_DIR for tests). Without the marker → exits 0 silently.
//
// buddy-inject is the UserPromptSubmit hook that reads
// /workspace/.claude/buddy/guidance.txt and emits additionalContext.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SPAWN_SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'spawn-buddy.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

let tmpRoot: string;
let overlayDir: string;
let markerFile: string;

function runSpawn(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SPAWN_SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      OVERLAY_MARKER_DIR: overlayDir,
      BUDDY_STATE_DIR: path.join(tmpRoot, 'buddy-state'),
      ...env,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spawn-buddy-test-'));
  overlayDir = path.join(tmpRoot, 'overlay');
  fs.mkdirSync(overlayDir, { recursive: true });
  markerFile = path.join(overlayDir, '.overlay-buddy-monitor');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('spawn-buddy.sh — Model A symmetric opt-in', () => {
  it('marker absent → exits 0 silently (no buddy fork)', () => {
    expect(fs.existsSync(markerFile)).toBe(false);
    const r = runSpawn({ tool_name: 'Edit', tool_input: { file_path: '/x' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
    expect(r.stderr).toBe('');
  });

  it('marker absent + send_message → still exits 0 silently', () => {
    const r = runSpawn({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] x' },
    });
    expect(r.status).toBe(0);
  });

  it('marker present + read-only tool → exits 0 (filtered)', () => {
    fs.writeFileSync(markerFile, 'buddy-monitor\n');
    for (const tool of ['Read', 'Grep', 'Glob', 'LS', 'WebSearch', 'WebFetch']) {
      const r = runSpawn({ tool_name: tool, tool_input: {} });
      expect(r.status, `read-only ${tool} should pass through`).toBe(0);
    }
  });

  it('marker present + non-read tool → spawn returns 0 (fork happens, hook returns)', () => {
    // The spawn `nohup bash /app/scripts/buddy-call.sh &` references a path
    // that doesn't exist in the test env; nohup itself still succeeds (it
    // detaches and the missing-script error happens in the background).
    // The HOOK exits 0 cleanly — that's what we're verifying.
    fs.writeFileSync(markerFile, 'buddy-monitor\n');
    const r = runSpawn({ tool_name: 'Edit', tool_input: { file_path: '/workspace/agent/foo.ts' } });
    expect(r.status).toBe(0);
  });
});

// buddy-inject.sh tests would need to write to /workspace/.claude/buddy/
// which isn't writable from vitest. The path is hardcoded in the script
// (intentionally — it's the per-session container mount path). Container
// integration testing covers the inject end-to-end path post-deploy.
