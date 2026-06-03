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
let stateFile: string;

function run(payload: object): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      WORKFLOW_STATE_FILE: stateFile,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-chain-routing-test-'));
  stateFile = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// The hook is ALWAYS ON (not gated by an overlay marker). It is self-scoping:
// it only acts on send_message bodies carrying a chain delivery marker.
describe('gate-chain-routing.sh', () => {
  it('blocks marked send_message without in_reply_to', () => {
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[Resolution] done' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('CHAIN ROUTING REQUIRED');
    expect(result.stderr).toContain('in_reply_to');
  });

  it('allows marked send_message with in_reply_to alone (thread_id derived)', () => {
    // Canonical upstream report form: send_message(to="parent", in_reply_to=<id>, ...).
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Triage Resolution] done', in_reply_to: 12 },
    });
    expect(result.status).toBe(0);
  });

  it('allows marked send_message with both routing fields', () => {
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[handoff] done', thread_id: 't1', in_reply_to: 12 },
    });
    expect(result.status).toBe(0);
  });

  it('thread_id alone (no in_reply_to) is still blocked', () => {
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: '[Fix Report] done', thread_id: 't1' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('in_reply_to');
  });

  it('non-delivery message passes (self-scoping on the marker)', () => {
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'peer', text: 'normal update' },
    });
    expect(result.status).toBe(0);
  });

  it('non-send_message tool passes', () => {
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'echo [Fix Report]' },
    });
    expect(result.status).toBe(0);
  });

  it('soft-caps after 3 denials so it cannot thrash', () => {
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
