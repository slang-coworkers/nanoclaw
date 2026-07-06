// Integration tests for container/hooks/track-critique.sh.
//
// PostToolUse on mcp__codex__codex / mcp__codex__codex-reply: every successful
// codex call counts as a critique round, EXCEPT calls made by Buddy (which
// we identify by signature). Buddy's first codex() call carries the
// reviewer charter (which starts with "You are Buddy") in
// developer-instructions; subsequent codex-reply calls send "BATCH n ("
// in the prompt. Anything else → critique → bumps critique_rounds.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'track-critique.sh');

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
      HOME: tmpRoot,
      WORKFLOW_STATE_FILE: stateFile,
    },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

function readState(): { critique_rounds?: number; edits_since_critique?: number; last_critique_at?: string } {
  if (!fs.existsSync(stateFile)) return {};
  return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'track-crit-test-'));
  stateFile = path.join(tmpRoot, 'workflow-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('track-critique counts genuine critique calls', () => {
  it('increments critique_rounds on a codex() call with non-Buddy prompt', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: {
        prompt: 'STAGE: PLAN_REVIEW\nTASK: ...\nWHAT I DID: ...',
        'developer-instructions': 'You are an independent reviewer with read-only workspace access.',
      },
      tool_response: '{"verdict":"approve"}',
    });
    expect(readState().critique_rounds).toBe(1);
  });

  it('increments on a codex-reply call with non-batch prompt', () => {
    run({
      tool_name: 'mcp__codex__codex-reply',
      tool_input: { prompt: 'I addressed items 1, 2, 3 — re-verify' },
      tool_response: '{"verdict":"approve"}',
    });
    expect(readState().critique_rounds).toBe(1);
  });

  it('zeroes edits_since_critique on increment', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1, edits_since_critique: 7 }));
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW\nTASK: ...', 'developer-instructions': 'reviewer' },
      tool_response: 'ok',
    });
    const state = readState();
    expect(state.critique_rounds).toBe(2);
    expect(state.edits_since_critique).toBe(0);
  });

  it('records last_critique_at timestamp', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: PLAN_REVIEW' },
      tool_response: '{}',
    });
    expect(readState().last_critique_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('track-critique correctly skips Buddy calls', () => {
  it('does NOT increment when developer-instructions starts with "You are Buddy"', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: {
        prompt: 'BASE_CONTEXT: ...',
        'developer-instructions': 'You are Buddy, an independent reviewer watching a primary agent work.',
      },
      tool_response: '{}',
    });
    expect(readState().critique_rounds ?? 0).toBe(0);
  });

  it('does NOT increment on codex-reply with BATCH-shaped prompt', () => {
    run({
      tool_name: 'mcp__codex__codex-reply',
      tool_input: { prompt: 'BATCH 3 (5 turns since last review):\n\n[Edit] foo.ts L12' },
      tool_response: 'OK',
    });
    expect(readState().critique_rounds ?? 0).toBe(0);
  });
});

describe('track-critique skips error responses', () => {
  it('does NOT increment when tool_response indicates error', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW' },
      tool_response: '{"error":"timed out"}',
    });
    expect(readState().critique_rounds ?? 0).toBe(0);
  });

  it('does NOT increment when tool_response carries is_error', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW' },
      tool_response: '{"is_error":true,"content":"network unreachable"}',
    });
    expect(readState().critique_rounds ?? 0).toBe(0);
  });
});

describe('track-critique records verdicts', () => {
  it('records approve verdict for a stage', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: {
        prompt: 'STAGE: OUTPUT_REVIEW\nTASK: fix\nWHAT I DID: wrote report',
        sandbox: 'danger-full-access',
      },
      tool_response: '{"threadId":"t1","content":"### Verdict\\napprove\\n\\n### Must-fix (blocks merge)\\n- None."}',
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.OUTPUT_REVIEW).toBe('approve');
  });

  it('records must-fix verdict for a stage', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: {
        prompt: 'STAGE: OUTPUT_REVIEW\nTASK: fix\nWHAT I DID: wrote report',
        sandbox: 'danger-full-access',
      },
      tool_response:
        '{"threadId":"t1","content":"### Verdict\\nmust-fix\\n\\n### Must-fix (blocks merge)\\n- file.ts:10 — wrong claim"}',
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.OUTPUT_REVIEW).toBe('must-fix');
  });

  it('overwrites previous verdict on re-run', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: OUTPUT_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: '{"threadId":"t1","content":"### Verdict\\nmust-fix\\n\\n### Must-fix\\n- bad"}',
    });
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: OUTPUT_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: '{"threadId":"t1","content":"### Verdict\\napprove\\n\\n### Must-fix\\n- None."}',
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.OUTPUT_REVIEW).toBe('approve');
  });

  it('tracks verdicts per stage independently', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: PLAN_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: '{"threadId":"t1","content":"### Verdict\\napprove\\n\\n### Must-fix\\n- None."}',
    });
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: '{"threadId":"t2","content":"### Verdict\\nmust-fix\\n\\n### Must-fix\\n- bug"}',
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.PLAN_REVIEW).toBe('approve');
    expect(state.critique_verdicts?.CODE_REVIEW).toBe('must-fix');
  });

  it('records verdict from a response larger than 2KB (regression: truncation dropped it)', () => {
    // 45% of June must-fix verdicts were >2KB and got silently dropped by the
    // old `head -c 2000` pre-parse truncation — must-fix reviews are the long
    // ones, so the bias hit exactly the verdicts the gate exists to enforce.
    const filler = Array.from({ length: 200 }, (_, i) => `- src/file${i}.ts:${i} — long review detail line`).join(
      '\n',
    );
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: OUTPUT_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: JSON.stringify({
        threadId: 't-long',
        content: `### Verdict\nmust-fix\n\n### Must-fix (blocks merge)\n${filler}`,
      }),
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.OUTPUT_REVIEW).toBe('must-fix');
  });

  it('records verdict when tool_response is an object rather than a JSON string', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: { threadId: 't-obj', content: '### Verdict\napprove\n\n### Must-fix\n- None.' },
    });
    const state = readState() as any;
    expect(state.critique_verdicts?.CODE_REVIEW).toBe('approve');
  });

  it('does not record verdict when response has no Verdict header', () => {
    run({
      tool_name: 'mcp__codex__codex',
      tool_input: { prompt: 'STAGE: CODE_REVIEW\nTASK: fix', sandbox: 'danger-full-access' },
      tool_response: '{"threadId":"t1","content":"some random response without structured output"}',
    });
    const state = readState() as any;
    expect(state.critique_verdicts).toBeUndefined();
  });
});

describe('track-critique ignores non-codex tools', () => {
  it('exits 0 silently for Edit', () => {
    const res = run({
      tool_name: 'Edit',
      tool_input: { file_path: '/x' },
      tool_response: '',
    });
    expect(res.status).toBe(0);
    expect(readState().critique_rounds).toBeUndefined();
  });

  it('exits 0 silently for unrelated MCP tools', () => {
    const res = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: 'hi' },
      tool_response: '',
    });
    expect(res.status).toBe(0);
    expect(readState().critique_rounds).toBeUndefined();
  });
});
