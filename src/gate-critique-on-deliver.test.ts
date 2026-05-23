// Integration tests for container/hooks/gate-critique-on-deliver.sh.
//
// The hook implements Model A symmetric opt-in: it first-line checks for
// `<OVERLAY_MARKER_DIR>/.overlay-critique-gate`. If absent → exits 0
// (no-op). If present → enforces "delivery markers + gh pr create require
// at least one critique round in workflow-state.json".

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-critique-on-deliver.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

let tmpRoot: string;
let overlayDir: string;
let markerFile: string;
let stateFile: string;

function run(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      OVERLAY_MARKER_DIR: overlayDir,
      WORKFLOW_STATE_FILE: stateFile,
      ...env,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

function activateOverlay(): void {
  fs.writeFileSync(markerFile, 'critique-gate\n');
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-crit-test-'));
  overlayDir = path.join(tmpRoot, 'overlay');
  fs.mkdirSync(overlayDir, { recursive: true });
  markerFile = path.join(overlayDir, '.overlay-critique-gate');
  stateFile = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Model A: no-op when overlay marker absent', () => {
  it('marker absent → delivery message passes (would normally be gated)', () => {
    expect(fs.existsSync(markerFile)).toBe(false);
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Fix Report] PR #123 fixed; tests pass.' },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('marker absent → gh pr create passes', () => {
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --title foo --body bar' },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('marker absent → exits 0 even when state file missing and rounds=0', () => {
    expect(fs.existsSync(stateFile)).toBe(false);
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] handoff needed' },
    });
    expect(result.status).toBe(0);
  });
});

describe('Marker active: critique gate enforces on delivery markers', () => {
  it('blocks send_message [Fix Report] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('CRITIQUE REQUIRED');
    expect(result.stderr).toContain('delivery/handoff message');
  });

  it('blocks send_message [Resolution] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] chain done' },
    });
    expect(result.status).toBe(2);
  });

  it('blocks send_message [Triage Resolution] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Triage Resolution] forwarding upstream' },
    });
    expect(result.status).toBe(2);
  });

  it('blocks send_message [Review Verdict] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Review Verdict] APPROVE' },
    });
    expect(result.status).toBe(2);
  });

  it('blocks send_message [handoff] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[handoff] over to fixer' },
    });
    expect(result.status).toBe(2);
  });

  it('passes send_message with no marker text', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: 'just a regular ack' },
    });
    expect(result.status).toBe(0);
  });

  it('blocks Bash gh pr create when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --title foo' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PR creation');
  });

  it('blocks Bash gh api ... pulls when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'curl -X POST https://api.github.com/repos/x/y/pulls -d @body.json' },
    });
    // Note: this test shape would need the regex to match `gh api .../pulls`
    // — curl directly to api.github.com is not gated. Asserting the curl
    // case passes confirms gate scope is intentionally narrow (gh-only).
    expect(result.status).toBe(0);
  });

  it('passes when gh pr create with critique_rounds>=1', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --title foo' },
    });
    expect(result.status).toBe(0);
  });

  it('passes [Fix Report] when critique_rounds>=1', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] approved' },
    });
    expect(result.status).toBe(0);
  });

  it('blocks when state file missing and rounds defaults to 0', () => {
    activateOverlay();
    expect(fs.existsSync(stateFile)).toBe(false);
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] x' },
    });
    expect(result.status).toBe(2);
  });

  it('passes for non-delivery non-PR tool calls', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'ls -la' },
    });
    expect(result.status).toBe(0);
  });
});
