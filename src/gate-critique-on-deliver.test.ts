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

  it('mid-sentence MENTION of a marker is not a delivery (anchored match)', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: 'Still working — I will send the [Fix Report] after the review completes.' },
    });
    expect(result.status).toBe(0);
  });

  it('indented marker at line start still gates', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: 'Summary first.\n  [Fix Report] PR #9 fixed' },
    });
    expect(result.status).toBe(2);
  });

  it('denial message no longer advertises the state-file path', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] x' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).not.toContain(stateFile);
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

  it('blocks direct curl to api.github.com/.../pulls when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'curl -X POST https://api.github.com/repos/x/y/pulls -d @body.json' },
    });
    // Previously asserted as intentionally-narrow (gh-only) — but curl to the
    // same endpoint is the same delivery with a different client, so the
    // scope now covers the /pulls route regardless of http client.
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PR creation');
  });

  it('blocks GraphQL createPullRequest mutations when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: {
        command: `gh api graphql -f query='mutation { createPullRequest(input: {repositoryId: "r", baseRefName: "main", headRefName: "f", title: "t"}) { pullRequest { url } } }'`,
      },
    });
    expect(result.status).toBe(2);
  });

  it('passes gh api pulls listing... still gated (unchanged legacy scope)', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'gh api repos/x/y/pulls' },
    });
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

describe('graduated escalation at the denial cap', () => {
  const denyPayload = () => ({
    tool_name: 'mcp__nanoclaw__send_message',
    tool_input: { text: '[Fix Report] x' },
  });
  const escFile = () => path.join(tmpRoot, 'critique-escalation.json');

  it('at the cap: denies, requests human approval, writes the escalation file', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('requesting human approval');
    const esc = JSON.parse(fs.readFileSync(escFile(), 'utf-8')) as { requested_at: number; reason: string };
    expect(esc.requested_at).toBeGreaterThan(0);
    expect(esc.reason).toContain('no critique rounds');
    // Second attempt while pending: still denied — no silent fail-open.
    const again = run(denyPayload());
    expect(again.status).toBe(2);
    expect(again.stderr).toContain('awaiting human approval');
  });

  it('admin-approved bypass allows the delivery', () => {
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3, critique_gate_bypass_approved: true }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('admin-approved bypass');
  });

  it('admin-rejected bypass keeps denying', () => {
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3, critique_gate_bypass_rejected: true }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('REJECTED');
  });

  it('times out to fail-open when no decision lands', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    fs.writeFileSync(
      escFile(),
      JSON.stringify({ requested_at: Math.floor(Date.now() / 1000) - 3600, reason: 'x' }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('escalation timeout');
  });

  it('CRITIQUE_ESCALATION=0 restores the legacy fail-open cap', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    const result = run(denyPayload(), { CRITIQUE_ESCALATION: '0' });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('soft-fail');
  });
});

describe('OUTPUT_REVIEW verdict gate', () => {
  function activateWithStages(stages: string[]): void {
    fs.writeFileSync(markerFile, 'critique-gate\n');
    fs.writeFileSync(path.join(overlayDir, '.critique-required-stages'), JSON.stringify(stages));
  }

  it('blocks delivery when OUTPUT_REVIEW verdict is must-fix', () => {
    activateWithStages(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1, OUTPUT_REVIEW: 1 },
        critique_verdicts: { PLAN_REVIEW: 'approve', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'must-fix' },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('OUTPUT_REVIEW last verdict is "must-fix"');
  });

  it('passes delivery when OUTPUT_REVIEW verdict is approve', () => {
    activateWithStages(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 4,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1, OUTPUT_REVIEW: 2 },
        critique_verdicts: { PLAN_REVIEW: 'approve', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(0);
  });

  it('fails closed when OUTPUT_REVIEW is required but no verdict was recorded', () => {
    // 33% of June stage-rounds had no recorded verdict; passing them
    // count-only was exactly the leak the verdict gate exists to close.
    activateWithStages(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1, OUTPUT_REVIEW: 1 },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('no verdict was recorded');
  });

  it('CRITIQUE_VERDICT_STRICT=0 restores the legacy count-only fallthrough', () => {
    activateWithStages(['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1, OUTPUT_REVIEW: 1 },
      }),
    );
    const result = run(
      {
        tool_name: 'mcp__nanoclaw__send_message',
        tool_input: { text: '[Fix Report] PR #123 ready' },
      },
      { CRITIQUE_VERDICT_STRICT: '0' },
    );
    expect(result.status).toBe(0);
  });

  it('blocks delivery when OUTPUT_REVIEW verdict is unparseable', () => {
    activateWithStages(['OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 1,
        critique_stages: { OUTPUT_REVIEW: 1 },
        critique_verdicts: { OUTPUT_REVIEW: 'unparseable' },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('unparseable');
  });

  it('blocks gh pr create when OUTPUT_REVIEW verdict is must-fix', () => {
    activateWithStages(['OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 1,
        critique_stages: { OUTPUT_REVIEW: 1 },
        critique_verdicts: { OUTPUT_REVIEW: 'must-fix' },
      }),
    );
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --title foo' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('OUTPUT_REVIEW');
  });

  it('does not enforce verdict for stages other than OUTPUT_REVIEW', () => {
    activateWithStages(['PLAN_REVIEW', 'CODE_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 2,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1 },
        critique_verdicts: { PLAN_REVIEW: 'must-fix', CODE_REVIEW: 'must-fix' },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Fix Report] PR #123 ready' },
    });
    expect(result.status).toBe(0);
  });
});
