import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-chain-routing.sh');

interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

let tmpRoot: string;
let overlayDir: string;
let markerFile: string;

let stateFile: string;

function run(payload: object): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      OVERLAY_MARKER_DIR: overlayDir,
      WORKFLOW_STATE_FILE: stateFile,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

function activateOverlay(): void {
  fs.writeFileSync(markerFile, 'chain-routing-gate\n');
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-chain-routing-test-'));
  overlayDir = path.join(tmpRoot, 'overlay');
  fs.mkdirSync(overlayDir, { recursive: true });
  markerFile = path.join(overlayDir, '.overlay-chain-routing-gate');
  stateFile = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('gate-chain-routing.sh', () => {
  it('marker absent → delivery message passes', () => {
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[Fix Report] done' },
    });
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('marker present → blocks marked send_message without in_reply_to', () => {
    activateOverlay();
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[Resolution] done' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('CHAIN ROUTING REQUIRED');
    expect(result.stderr).toContain('in_reply_to');
  });

  it('marker present → allows marked send_message with in_reply_to alone (thread_id derived)', () => {
    // Canonical upstream report form: send_message(to="parent", in_reply_to=<id>, ...).
    activateOverlay();
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Triage Resolution] done', in_reply_to: 12 },
    });
    expect(result.status).toBe(0);
  });

  it('marker present → allows marked send_message with both routing fields', () => {
    activateOverlay();
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[handoff] done', thread_id: 't1', in_reply_to: 12 },
    });
    expect(result.status).toBe(0);
  });

  it('marker present → thread_id alone (no in_reply_to) is still blocked', () => {
    activateOverlay();
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[Fix Report] done', thread_id: 't1' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('in_reply_to');
  });

  it('marker present → non-delivery message passes', () => {
    activateOverlay();
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: 'normal update' },
    });
    expect(result.status).toBe(0);
  });

  it('marker present → soft-caps after 3 denials so it cannot thrash', () => {
    activateOverlay();
    const payload = {
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Fix Report] done' },
    };
    expect(run(payload).status).toBe(2); // denial 1
    expect(run(payload).status).toBe(2); // denial 2
    expect(run(payload).status).toBe(2); // denial 3
    const capped = run(payload);
    expect(capped.status).toBe(0); // soft-cap: yields
    expect(capped.stderr).toContain('soft-fail');
  });
});
