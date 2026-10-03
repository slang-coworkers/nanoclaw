// Integration tests for container/hooks/gate-critique-on-deliver.sh.
//
// The hook implements Model A symmetric opt-in: it first-line checks for
// `<OVERLAY_MARKER_DIR>/.overlay-critique-gate`. If absent → exits 0
// (no-op). If present → enforces "delivery markers + gh pr create require
// at least one critique round in workflow-state.json".

import { spawnSync } from 'child_process';
import crypto from 'crypto';
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
let explainStateFile: string;

function run(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify(payload),
    env: {
      PATH: process.env.PATH || '',
      OVERLAY_MARKER_DIR: overlayDir,
      WORKFLOW_STATE_FILE: stateFile,
      EXPLAIN_DIFF_STATE_FILE: explainStateFile,
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
  explainStateFile = path.join(tmpRoot, 'explain-diff-state.json');
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Model A: no-op when overlay marker absent', () => {
  it('marker absent → delivery message passes (would normally be gated)', () => {
    expect(fs.existsSync(markerFile)).toBe(false);
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Resolution] PR #123 fixed; tests pass.' },
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

describe('env-based activation (tamper-resistant)', () => {
  it('CRITIQUE_GATE_ACTIVE=1 gates even when the marker file is absent', () => {
    expect(fs.existsSync(markerFile)).toBe(false);
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] x' } },
      { CRITIQUE_GATE_ACTIVE: '1' },
    );
    expect(result.status).toBe(2);
  });

  it('CRITIQUE_GATE_ACTIVE=0 disables even when the marker file is present', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] x' } },
      { CRITIQUE_GATE_ACTIVE: '0' },
    );
    expect(result.status).toBe(0);
  });

  it('CRITIQUE_REQUIRED_STAGES env overrides the (agent-writable) file', () => {
    activateOverlay();
    // File says "no stages" (legacy 1-round) but env demands OUTPUT_REVIEW.
    fs.writeFileSync(path.join(overlayDir, '.critique-required-stages'), JSON.stringify([]));
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 5, critique_stages: { PLAN_REVIEW: 1 } }));
    const result = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] x' } },
      { CRITIQUE_GATE_ACTIVE: '1', CRITIQUE_REQUIRED_STAGES: JSON.stringify(['OUTPUT_REVIEW']) },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('OUTPUT_REVIEW');
  });
});

describe('Marker active: critique gate enforces on delivery markers', () => {
  it('blocks send_message [Resolution] when critique_rounds=0', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { to: 'parent', text: '[Resolution] PR #123 ready' },
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

  it('role-specific markers ([Triage Resolution], [Review Verdict]) are NOT built-in — they gate only when declared per-role', () => {
    // Post floor-slim: the built-in floor is the general primitives only
    // (Resolution/handoff). Role terminal names gate solely via each role's
    // delivery_markers → .critique-delivery-markers.
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    for (const text of ['[Triage Resolution] forwarding upstream', '[Review Verdict] APPROVE']) {
      // Not built-in → passes with no per-role vocab file.
      expect(run({ tool_name: 'mcp__nanoclaw__send_message', tool_input: { text } }).status).toBe(0);
    }
    // Declared per-role → gated like a built-in.
    fs.writeFileSync(
      path.join(overlayDir, '.critique-delivery-markers'),
      JSON.stringify({ message_markers: ['Triage Resolution', 'Review Verdict'] }),
    );
    for (const text of ['[Triage Resolution] forwarding upstream', '[Review Verdict] APPROVE']) {
      expect(run({ tool_name: 'mcp__nanoclaw__send_message', tool_input: { text } }).status).toBe(2);
    }
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
      tool_input: { text: 'Still working — I will send the [Resolution] after the review completes.' },
    });
    expect(result.status).toBe(0);
  });

  it('indented marker at line start still gates', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: 'Summary first.\n  [Resolution] PR #9 fixed' },
    });
    expect(result.status).toBe(2);
  });

  it('denial message no longer advertises the state-file path', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] x' },
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

  it('passes [Resolution] when critique_rounds>=1', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] approved' },
    });
    expect(result.status).toBe(0);
  });

  it('blocks when state file missing and rounds defaults to 0', () => {
    activateOverlay();
    expect(fs.existsSync(stateFile)).toBe(false);
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] x' },
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

describe('configurable delivery vocabulary (.critique-delivery-markers)', () => {
  function writeVocab(vocab: object): void {
    fs.writeFileSync(path.join(overlayDir, '.critique-delivery-markers'), JSON.stringify(vocab));
  }

  it('a configured extra marker gates like a built-in', () => {
    activateOverlay();
    writeVocab({ message_markers: ['Weekly Report'], bash_patterns: [] });
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Weekly Report] all green' },
    });
    expect(result.status).toBe(2);
  });

  it('a configured extra bash pattern gates like a built-in', () => {
    activateOverlay();
    writeVocab({ message_markers: [], bash_patterns: ['glab mr create'] });
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'Bash',
      tool_input: { command: 'glab mr create --title foo' },
    });
    expect(result.status).toBe(2);
  });

  it('built-in vocabulary survives regardless of the file (additive only)', () => {
    activateOverlay();
    writeVocab({ message_markers: [], bash_patterns: [] });
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] still gated' },
    });
    expect(result.status).toBe(2);
  });

  it('markers with regex metacharacters are ignored (sanitized at read)', () => {
    activateOverlay();
    // ".*" would match everything if spliced into the alternation.
    writeVocab({ message_markers: ['.*'], bash_patterns: [] });
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[anything] not a real marker' },
    });
    expect(result.status).toBe(0);
  });
});

describe('graduated escalation at the denial cap', () => {
  const denyPayload = () => ({
    tool_name: 'mcp__nanoclaw__send_message',
    tool_input: { text: '[Resolution] x' },
  });
  const escFile = () => path.join(tmpRoot, 'critique-escalation.json');

  const readEsc = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(escFile(), 'utf-8')) as Record<string, unknown>;
  const readState = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
  /** The append-only release journal — the sink the host cannot retire away. */
  const readJournal = (): Array<Record<string, unknown>> =>
    fs
      .readFileSync(path.join(tmpRoot, 'critique-releases.jsonl'), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  it('at the cap: denies and opens an escalation file', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('escalation opened');
    const esc = readEsc() as { requested_at: number; reason: string };
    expect(esc.requested_at).toBeGreaterThan(0);
    expect(esc.reason).toContain('no critique rounds');
    // Second attempt while the escalation is open: still denied.
    const again = run(denyPayload());
    expect(again.status).toBe(2);
    expect(again.stderr).toContain('denial cap reached');
  });

  it('NEVER times out to fail-open — an old, undecided escalation stays denied', () => {
    // This is the enforcement regression test. The gate used to allow the
    // delivery once CRITIQUE_ESCALATION_TIMEOUT_SECS (30 min) elapsed, which
    // meant an agent could satisfy the requirement by waiting.
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    fs.writeFileSync(
      escFile(),
      JSON.stringify({ requested_at: Math.floor(Date.now() / 1000) - 86_400, reason: 'x', forwarded_at: 'ts' }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('will NOT time out');
    expect(readEsc().failed_open_at).toBeUndefined();
  });

  it('admin-approved bypass allows the delivery ONCE, then consumes itself', () => {
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 0,
        critique_gate_denials: 3,
        critique_gate_bypass_approved: true,
        critique_gate_bypass_grant_id: 'appr-1',
        critique_gate_bypass_expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('CONSUMED');
    // The grant is spent, and the release is recorded for the host to see.
    expect(readState().critique_gate_bypass_approved).toBe(false);
    expect(readState().critique_gate_bypass_consumed_at).toBeGreaterThan(0);
    // Attribution: the host reconciler matches consumption on this id. Without
    // it, a legitimate bypass reads as consumption of a grant nobody issued —
    // a false positive on the happy path, on every shell-path bypass.
    expect(readState().critique_gate_bypass_consumed_grant_id).toBe('appr-1');
    // No escalation file exists on this path, and the gate must not invent
    // one: the release goes to the append-only journal instead.
    expect(fs.existsSync(escFile())).toBe(false);
    expect(readJournal()[0].grant_id).toBe('appr-1');
    // A second delivery is denied again — it is not a standing grant.
    const again = run(denyPayload());
    expect(again.status).toBe(2);
  });

  it('a bypass with NO expiry is not an unlimited bypass — it is refused', () => {
    // Treating a missing expiry as "no expiry" would let a forged flag with no
    // expiry at all defeat the TTL entirely.
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3, critique_gate_bypass_approved: true }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('no usable expiry');
    expect(readState().critique_gate_bypass_approved).toBe(false);
  });

  it('an EXPIRED bypass does not allow the delivery', () => {
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 0,
        critique_gate_denials: 3,
        critique_gate_bypass_approved: true,
        critique_gate_bypass_expires_at: Math.floor(Date.now() / 1000) - 60,
      }),
    );
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('EXPIRED');
    expect(readState().critique_gate_bypass_approved).toBe(false);
  });

  it('admin-rejected bypass keeps denying the request it answered', () => {
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 0,
        critique_gate_denials: 3,
        critique_gate_bypass_rejected: true,
        critique_gate_bypass_rejected_request: 5000,
      }),
    );
    fs.writeFileSync(escFile(), JSON.stringify({ requested_at: 5000, reason: 'x' }));
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('REJECTED');
  });

  it('a rejection from an EARLIER escalation does not answer a new one', () => {
    // Unscoped, the rejected flag latched forever: one old "no" silently
    // decided every later delivery in the session and suppressed re-escalation.
    activateOverlay();
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 0,
        critique_gate_denials: 3,
        critique_gate_bypass_rejected: true,
        critique_gate_bypass_rejected_request: 5000,
      }),
    );
    fs.writeFileSync(escFile(), JSON.stringify({ requested_at: 9999, reason: 'x' }));
    const result = run(denyPayload());
    expect(result.status).toBe(2);
    // Still denied (enforcement holds), but as a live escalation rather than
    // as an answered-and-closed rejection.
    expect(result.stderr).not.toContain('an admin REJECTED');
  });

  it('CRITIQUE_ESCALATION=0 still fails open, but now records the release', () => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    const result = run(denyPayload(), { CRITIQUE_ESCALATION: '0' });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('soft-fail');
    // Container stderr dies with the container; the journal is how the host
    // learns. There is no escalation file on this path — the kill switch
    // returns before one is ever opened — and the gate must NOT invent one.
    expect(fs.existsSync(escFile())).toBe(false);
    expect(String(readJournal()[0].why)).toContain('kill switch');
  });
});

describe('long public comments need a reviewed body file', () => {
  // Post-mortem shader-slang/slang#13073 → PR #13213: a 2,214-char public
  // restatement of a maintainer's design went out 8 s after it was asked for,
  // before the fidelity check that found ~11 misses. Comment commands never
  // matched the PR-creation patterns, so nothing gated them.
  const LONG = 'The maintainer asked for X. '.repeat(50); // ~1400 chars
  const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command } });
  const sha = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  const readState = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;

  let bodyFile: string;
  beforeEach(() => {
    activateOverlay();
    bodyFile = path.join(tmpRoot, 'comment.md');
    fs.writeFileSync(bodyFile, LONG);
  });

  function reviewed(file: string, verdict = 'approve'): void {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 1,
        critique_gate_denials: 0,
        critique_stages: { OUTPUT_REVIEW: 1 },
        critique_verdicts: { OUTPUT_REVIEW: verdict },
        critique_attested: { OUTPUT_REVIEW: { [file]: sha(file) } },
      }),
    );
  }

  it('a short inline comment passes with no critique at all', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const r = run(bash('gh issue comment 13073 --repo shader-slang/slang --body "Holding: fix in draft PR #13213."'));
    expect(r.status).toBe(0);
  });

  it('a long inline --body is denied', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const r = run(bash(`gh issue comment 13073 --repo shader-slang/slang --body "${LONG}"`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PUBLIC COMMENT REVIEW REQUIRED');
    expect(r.stderr).toContain('inline');
    expect(r.stderr).toContain('STAGE: OUTPUT_REVIEW');
  });

  it('a long heredoc on stdin (--body-file -) is denied', () => {
    const r = run(bash(`gh pr comment 13213 --body-file - <<'EOF'\n${LONG}\nEOF`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('PUBLIC COMMENT REVIEW REQUIRED');
  });

  it('a body file an OUTPUT_REVIEW attested and approved passes', () => {
    reviewed(bodyFile);
    const r = run(bash(`gh issue comment 13073 --repo shader-slang/slang --body-file ${bodyFile}`));
    expect(r.status).toBe(0);
    // -F is gh's short form of --body-file.
    expect(run(bash(`gh pr comment 13213 -F ${bodyFile}`)).status).toBe(0);
    // A reviewed copy is the same text: only the hash matters, not the path.
    const copy = path.join(tmpRoot, 'copy.md');
    fs.copyFileSync(bodyFile, copy);
    expect(run(bash(`gh pr review 13213 --comment --body-file ${copy}`)).status).toBe(0);
  });

  it('a body file nobody reviewed is denied', () => {
    const other = path.join(tmpRoot, 'reviewed.md');
    fs.writeFileSync(other, 'something else\n');
    reviewed(other);
    const r = run(bash(`gh issue comment 13073 --body-file ${bodyFile}`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('is not among the files an OUTPUT_REVIEW attested');
  });

  it('an edit after the review changes the hash and is denied', () => {
    reviewed(bodyFile);
    fs.appendFileSync(bodyFile, 'one more unreviewed paragraph\n');
    expect(run(bash(`gh issue comment 13073 --body-file ${bodyFile}`)).status).toBe(2);
  });

  it('an attested file whose OUTPUT_REVIEW verdict is must-fix is denied', () => {
    reviewed(bodyFile, 'must-fix');
    const r = run(bash(`gh issue comment 13073 --body-file ${bodyFile}`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('"must-fix"');
  });

  it('gh api POST to issues/<n>/comments with -F body=@file is covered', () => {
    const cmd = `gh api repos/shader-slang/slang/issues/13073/comments -F body=@${bodyFile}`;
    const denied = run(bash(cmd));
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain('comment/review API call');
    reviewed(bodyFile);
    expect(run(bash(cmd)).status).toBe(0);
  });

  it('a PATCH that edits an existing comment is covered (gh api and curl)', () => {
    expect(run(bash(`gh api -X PATCH repos/o/r/issues/comments/987 -F body=@${bodyFile}`)).status).toBe(2);
    expect(
      run(bash(`curl -sS -X PATCH https://api.github.com/repos/o/r/issues/comments/987 --data-binary @${bodyFile}`))
        .status,
    ).toBe(2);
    // Inline JSON body through curl: sized by the command.
    expect(
      run(
        bash(
          `curl -X PATCH https://api.github.com/repos/o/r/issues/comments/987 -d '${JSON.stringify({ body: LONG })}'`,
        ),
      ).status,
    ).toBe(2);
    reviewed(bodyFile);
    expect(run(bash(`gh api -X PATCH repos/o/r/issues/comments/987 -F body=@${bodyFile}`)).status).toBe(0);
  });

  it('pull review comments and reviews are covered', () => {
    expect(run(bash(`gh api repos/o/r/pulls/5/comments -F body=@${bodyFile} -f path=a.c -F line=3`)).status).toBe(2);
    expect(run(bash(`gh api repos/o/r/pulls/5/reviews --input ${bodyFile}`)).status).toBe(2);
    expect(run(bash(`gh pr review 5 --request-changes --body "${LONG}"`)).status).toBe(2);
  });

  it('writing the body file and posting it in one command is denied even over a reviewed file', () => {
    // The existing file of that name was reviewed; the command overwrites it
    // with new, unreviewed text before posting — the hook runs before either.
    reviewed(bodyFile);
    const r = run(bash(`cat > ${bodyFile} <<'EOF'\n${LONG}\nEOF\ngh issue comment 1 --body-file ${bodyFile}`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('the command itself is');
  });

  it('reading a comment is not posting one', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const jqProgram = `.[] | select(.user.login == "maintainer") | "\\(.id) \\(.body)" ${'| ascii_downcase '.repeat(80)}`;
    expect(run(bash(`gh api repos/o/r/issues/1/comments --paginate --jq '${jqProgram}'`)).status).toBe(0);
    expect(run(bash('gh issue view 1 --comments')).status).toBe(0);
  });

  it('a relative body file resolves against the command cd', () => {
    const r = run(bash(`cd ${tmpRoot} && gh issue comment 1 --body-file comment.md`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(bodyFile);
    reviewed(bodyFile);
    expect(run(bash(`cd ${tmpRoot} && gh issue comment 1 --body-file comment.md`)).status).toBe(0);
  });

  it('an unresolvable body file is denied rather than guessed', () => {
    const r = run(bash('gh issue comment 1 --body-file "$BODY"'));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('cannot be resolved');
  });

  it('CRITIQUE_COMMENT_GATE=0 disables the check; CRITIQUE_COMMENT_MIN_CHARS moves the line', () => {
    const cmd = `gh issue comment 1 --body "${LONG}"`;
    expect(run(bash(cmd), { CRITIQUE_COMMENT_GATE: '0' }).status).toBe(0);
    expect(run(bash(cmd), { CRITIQUE_COMMENT_MIN_CHARS: '100000' }).status).toBe(0);
    expect(
      run(bash('gh issue comment 1 --body "a 60-char status note, nothing more than that, ok"'), {
        CRITIQUE_COMMENT_MIN_CHARS: '20',
      }).status,
    ).toBe(2);
  });

  it('comment denials never count toward the denial cap or open an escalation', () => {
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0, critique_gate_denials: 3 }));
    const r = run(bash(`gh issue comment 1 --body "${LONG}"`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('does not\ncount toward');
    expect(readState().critique_gate_denials).toBe(3);
    expect(fs.existsSync(path.join(tmpRoot, 'critique-escalation.json'))).toBe(false);
  });

  it('PR creation keeps its own path: --body-file on gh pr create is not a comment', () => {
    // An unreviewed, long body file: the PR-create gate decides, on critique
    // rounds, exactly as before.
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const denied = run(bash(`gh pr create --title t --body-file ${bodyFile}`));
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain('CRITIQUE REQUIRED before PR creation');
    expect(denied.stderr).not.toContain('PUBLIC COMMENT');
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    expect(run(bash(`gh pr create --title t --body-file ${bodyFile}`)).status).toBe(0);
  });
});

/** A review request that names its maintainer direction (the REVIEW_REQUEST_GATE format). */
const RR = (head: string): string =>
  `[Fix Review Request] ${head}\n\nMode: pr\nMaintainer direction: none — the issue has no maintainer design comments`;

describe('fix report / review request waits for the PR description refresh', () => {
  const AUTO_MAP = path.resolve(process.cwd(), 'container', 'hooks', 'pr-auto-map.sh');
  const send = (text: string) => ({ tool_name: 'mcp__nanoclaw__send_message', tool_input: { text } });
  const readState = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;

  /** Drive the real receipt writer, as the PostToolUse hook would. */
  function postToolUse(command: string, stdout: string, stderr = ''): void {
    const proc = spawnSync('bash', [AUTO_MAP], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, tool_response: { stdout, stderr } }),
      env: { PATH: process.env.PATH || '', EXPLAIN_DIFF_STATE_FILE: explainStateFile },
      encoding: 'utf-8',
    });
    expect(proc.status).toBe(0);
  }

  function openAndPush(): void {
    postToolUse('gh pr create --head fix/issue-13073 --title t', 'https://github.com/shader-slang/slang/pull/13213\n');
    postToolUse(
      'git push origin HEAD',
      '',
      'To https://github.com/slang-coworkers/slang.git\n   84be79e..555d69c  fix/issue-13073 -> fix/issue-13073\n',
    );
  }

  function explain(head: string): void {
    postToolUse(
      'python3 /home/node/.claude/skills/explain-diff-html/scripts/upsert_pr_body.py --repo "$R" --pr "$N" --head "$(git rev-parse HEAD)" --explanation /tmp/explain-body.md',
      `${JSON.stringify({ updated: true, repo: 'shader-slang/slang', pr: 13213, chars: 9000, head, legacy_comment: 'none' })}\n`,
    );
  }

  beforeEach(() => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1, critique_gate_denials: 0 }));
  });

  it('[Fix Review Request] is denied while a refresh is owed, then allowed after the upsert receipt', () => {
    openAndPush();
    const denied = run(send('[Fix Review Request] shader-slang/slang#13213 ready for review'));
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain('PR DESCRIPTION REFRESH REQUIRED');
    expect(denied.stderr).toContain('pushed 555d69c to shader-slang/slang#13213');
    expect(denied.stderr).toContain('/explain-diff-html');
    expect(denied.stderr).not.toContain('Invoke /codex-critique');
    // Remedy is an upsert, not a critique round: never counted toward escalation.
    expect(readState().critique_gate_denials).toBe(0);

    explain('555d69c0ffee');
    expect(run(send(RR('shader-slang/slang#13213 ready for review'))).status).toBe(0);
  });

  it('a push after the explanation makes it owed again', () => {
    openAndPush();
    explain('555d69c0ffee');
    postToolUse(
      'git push',
      '',
      'To https://github.com/slang-coworkers/slang.git\n   555d69c..9f8e7d6  fix/issue-13073 -> fix/issue-13073\n',
    );
    const denied = run(send('[Fix Review Request] round 2'));
    expect(denied.status).toBe(2);
    expect(denied.stderr).toContain('its description still explains head 555d69c');
  });

  it('[Fix Report] as a declared delivery marker: critique first, then the refresh', () => {
    fs.writeFileSync(
      path.join(overlayDir, '.critique-delivery-markers'),
      JSON.stringify({ message_markers: ['Fix Report'] }),
    );
    openAndPush();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const critique = run(send('[Fix Report] done'));
    expect(critique.status).toBe(2);
    expect(critique.stderr).toContain('no critique rounds recorded');
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    const refresh = run(send('[Fix Report] done'));
    expect(refresh.status).toBe(2);
    expect(refresh.stderr).toContain('PR DESCRIPTION REFRESH REQUIRED');
    explain('555d69c0ffee');
    expect(run(send('[Fix Report] done')).status).toBe(0);
  });

  it('other messages, no receipts, the kill switch, and an inactive gate all pass', () => {
    openAndPush();
    expect(run(send('Still working on the review comments.')).status).toBe(0);
    expect(run(send(RR('x')), { EXPLAIN_DIFF_GATE: '0' }).status).toBe(0);
    expect(run(send('[Fix Review Request] x'), { CRITIQUE_GATE_ACTIVE: '0' }).status).toBe(0);
    fs.rmSync(explainStateFile);
    expect(run(send(RR('x'))).status).toBe(0);
  });
});

describe('[Fix Review Request] must name its maintainer direction (REVIEW_REQUEST_GATE)', () => {
  const send = (text: string) => ({
    tool_name: 'mcp__nanoclaw__send_message',
    tool_input: { to: 'slang-reviewer', text },
  });
  const readState = (): Record<string, unknown> =>
    JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
  const HEAD =
    '[Fix Review Request] shader-slang/slang#13073: thread mode through specialization\n\nMode: pr\nPR / Patch: https://github.com/shader-slang/slang/pull/13213';
  const LINK = 'https://github.com/shader-slang/slang/issues/13073#issuecomment-3301234567';

  beforeEach(() => {
    activateOverlay();
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1, critique_gate_denials: 0 }));
  });

  it('passes with maintainer comment links and a self-check scoring them', () => {
    const r = run(
      send(`${HEAD}\nMaintainer direction: ${LINK}\nFixer self-check: R1 met · R2 partial (no options hook yet)`),
    );
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('passes with links and a self-check written as lists under bold labels', () => {
    const r = run(
      send(
        `${HEAD}\n**Maintainer direction:**\n- ${LINK} ("pure refactor")\n- https://github.com/shader-slang/slang/pull/13213#discussion_r2201234\n**Fixer self-check:**\n- R1 met\n- R2 met`,
      ),
    );
    expect(r.status).toBe(0);
  });

  it('passes with "none" followed by a reason (dash, colon or parentheses)', () => {
    for (const v of [
      'none — the issue has no maintainer comments',
      'none: reporter-only issue, no maintainer replied',
      'none (issue body is the only spec)',
    ]) {
      expect(run(send(`${HEAD}\nMaintainer direction: ${v}`)).status, v).toBe(0);
    }
  });

  it('refuses a bare "none" and says what to add — not counted toward escalation', () => {
    const r = run(send(`${HEAD}\nMaintainer direction: none`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('REVIEW REQUEST INCOMPLETE');
    expect(r.stderr).toContain('bare "none"');
    expect(r.stderr).toContain('Maintainer direction: none — <why no maintainer direction applies>');
    expect(r.stderr.trim().split('\n')).toHaveLength(1);
    expect(readState().critique_gate_denials).toBe(0);
  });

  it('refuses a request with no Maintainer direction line', () => {
    const r = run(send(`${HEAD}\nTests added: tests/x.slang\nTest results: PASS`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('no `Maintainer direction:` line');
    expect(readState().critique_gate_denials).toBe(0);
  });

  it('refuses a direction that neither links a comment nor says none with a reason', () => {
    const r = run(send(`${HEAD}\nMaintainer direction: see the issue thread`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('neither links a maintainer comment');
  });

  it('refuses links without a Fixer self-check, and a self-check with no R items', () => {
    const noCheck = run(send(`${HEAD}\nMaintainer direction: ${LINK}`));
    expect(noCheck.status).toBe(2);
    expect(noCheck.stderr).toContain('no `Fixer self-check:` line');
    const noItems = run(send(`${HEAD}\nMaintainer direction: ${LINK}\nFixer self-check: all addressed`));
    expect(noItems.status).toBe(2);
    expect(noItems.stderr).toContain('has no R1, R2… items');
  });

  it('accepts only canonical github.com comment URLs — spoofed hosts and malformed paths are refused', () => {
    for (const url of [
      'https://notgithub.com/shader-slang/slang/issues/13073#issuecomment-1',
      'https://github.com.evil/shader-slang/slang/issues/13073#issuecomment-1',
      'https://github.com/shader-slang/issues/13073#issuecomment-1',
      'https://github.com/shader-slang/slang/blob/master/README.md#issuecomment-1',
      'https://evil.example/?u=https://github.com/shader-slang/slang/issues/13073#issuecomment-1',
    ]) {
      const r = run(send(`${HEAD}\nMaintainer direction: ${url}\nFixer self-check: R1 met`));
      expect(r.status, url).toBe(2);
      expect(r.stderr, url).toContain('neither links a maintainer comment');
    }
  });

  it('accepts a canonical URL with a query string or as a markdown link', () => {
    for (const dir of [
      'https://github.com/shader-slang/slang/issues/13073?notification_referrer_id=NT_abc#issuecomment-3301234567',
      '[the design comment](https://github.com/shader-slang/slang/pull/13213/files#discussion_r2201234)',
    ]) {
      expect(run(send(`${HEAD}\nMaintainer direction: ${dir}\nFixer self-check: R1 met`)).status, dir).toBe(0);
    }
  });

  it('list items with their own colon stay under their label (`- R1: met`, `- Maintainer comment: <url>`)', () => {
    const r = run(
      send(
        `${HEAD}\nMaintainer direction:\n- Maintainer comment: ${LINK}\nFixer self-check:\n- R1: met\n- R2: partial (options hook later)`,
      ),
    );
    expect(r.status).toBe(0);
    expect(run(send(`${HEAD}\nMaintainer direction: ${LINK}\nFixer self-check:\nR1: met\nR2: met`)).status).toBe(0);
  });

  it('parses a CRLF body with both values on the following lines', () => {
    const body = [
      '[Fix Review Request] shader-slang/slang#13073: x',
      '',
      'Mode: pr',
      'Maintainer direction:',
      `- ${LINK}`,
      'Fixer self-check:',
      '- R1 met',
      '',
    ].join('\r\n');
    const r = run(send(body));
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('refuses "none (" with an unclosed parenthesis', () => {
    const r = run(send(`${HEAD}\nMaintainer direction: none (there were no maintainer comments`));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('REVIEW REQUEST INCOMPLETE');
  });

  it('REVIEW_REQUEST_GATE=0 turns it off', () => {
    expect(run(send(`${HEAD}\nMaintainer direction: none`), { REVIEW_REQUEST_GATE: '0' }).status).toBe(0);
  });

  it('leaves other messages alone, including ones that only mention the marker', () => {
    expect(run(send('Status: CI is green; I will send the [Fix Review Request] next.')).status).toBe(0);
    expect(run(send('Still applying the reviewer comments.')).status).toBe(0);
  });

  it('is a no-op where the critique gate is inactive', () => {
    fs.rmSync(markerFile);
    expect(run(send(`${HEAD}\nMaintainer direction: none`)).status).toBe(0);
    activateOverlay();
    expect(run(send(`${HEAD}\nMaintainer direction: none`), { CRITIQUE_GATE_ACTIVE: '0' }).status).toBe(0);
  });

  it('a declared [Fix Review Request] marker hears about the missing critique first', () => {
    fs.writeFileSync(
      path.join(overlayDir, '.critique-delivery-markers'),
      JSON.stringify({ message_markers: ['Fix Review Request'] }),
    );
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 0 }));
    const critique = run(send(`${HEAD}\nMaintainer direction: none`));
    expect(critique.status).toBe(2);
    expect(critique.stderr).toContain('no critique rounds recorded');
    fs.writeFileSync(stateFile, JSON.stringify({ critique_rounds: 1 }));
    expect(run(send(`${HEAD}\nMaintainer direction: none`)).stderr).toContain('REVIEW REQUEST INCOMPLETE');
    expect(run(send(`${HEAD}\nMaintainer direction: none — no maintainer comments`)).status).toBe(0);
  });
});

describe('release recording — the gate must never fabricate an escalation', () => {
  // `stamp_failed_open` used to CREATE critique-escalation.json with
  // `requested_at: 0` when the file was absent. The file is absent for a
  // mundane reason: the host retires a settled request, and it does so between
  // the gate's own two writes — the consumption patch to workflow-state.json,
  // and this stamp. The host then read the fabrication as a brand-new
  // escalation and carded a human for a decision nobody asked for, while the
  // real release went unrecorded and its link to the original request was gone.
  const denyPayload = () => ({
    tool_name: 'mcp__nanoclaw__send_message',
    tool_input: { text: '[Resolution] x' },
  });
  const escFile = () => path.join(tmpRoot, 'critique-escalation.json');
  const journalFile = () => path.join(tmpRoot, 'critique-releases.jsonl');
  const readJournal = (): Array<Record<string, unknown>> =>
    fs
      .readFileSync(journalFile(), 'utf-8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as Record<string, unknown>);

  function approvedBypassState(): void {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 0,
        critique_gate_denials: 3,
        critique_gate_bypass_approved: true,
        critique_gate_bypass_grant_id: 'appr-1',
        critique_gate_bypass_expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
  }

  it('a release with the escalation file GONE journals it instead of inventing one', () => {
    activateOverlay();
    approvedBypassState();
    expect(fs.existsSync(escFile())).toBe(false);

    const result = run(denyPayload());
    expect(result.status).toBe(0);

    // The corruption: no synthetic `requested_at: 0` escalation for the host
    // to card. The next denial re-opens a real one, as it should.
    expect(fs.existsSync(escFile())).toBe(false);

    const [entry] = readJournal();
    expect(entry.why).toBe('admin bypass consumed (one-shot)');
    // Attribution the host uses to re-attach this release to its request.
    expect(entry.grant_id).toBe('appr-1');
    expect(String(entry.event_id)).toMatch(/^rel-/);
    expect(entry.at).toBeTruthy();
  });

  it('a release with the escalation file PRESENT lands in both sinks under one id', () => {
    activateOverlay();
    approvedBypassState();
    fs.writeFileSync(escFile(), JSON.stringify({ requested_at: 1000, reason: 'x', forwarded_at: 'ts' }));

    expect(run(denyPayload()).status).toBe(0);

    const esc = JSON.parse(fs.readFileSync(escFile(), 'utf-8')) as Record<string, unknown>;
    // Merged, not replaced — the request's own audit context survives.
    expect(esc.requested_at).toBe(1000);
    expect(esc.failed_open_at).toBeTruthy();
    // One id across both routes is what lets the host record it exactly once.
    expect(readJournal()[0].event_id).toBe(esc.failed_open_event_id);
  });

  it('REFUSES the delivery when the release cannot be recorded anywhere', () => {
    // A release nobody can see is worse than a denied delivery: the grant is
    // one-shot either way, but an invisible fail-open is unrecoverable.
    activateOverlay();
    approvedBypassState();
    const roDir = path.join(tmpRoot, 'unwritable');
    fs.mkdirSync(roDir);
    fs.chmodSync(roDir, 0o500);
    try {
      const result = run(denyPayload(), {
        CRITIQUE_ESCALATION_FILE: path.join(roDir, 'critique-escalation.json'),
        CRITIQUE_RELEASE_JOURNAL: path.join(roDir, 'critique-releases.jsonl'),
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('could NOT be recorded');
      // The grant was already spent by the consumption write above; the host
      // reports it as an ORPHANED release rather than losing track of it.
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
      expect(state.critique_gate_bypass_approved).toBe(false);
      expect(state.critique_gate_bypass_consumed_grant_id).toBe('appr-1');
    } finally {
      fs.chmodSync(roDir, 0o700);
    }
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
      tool_input: { text: '[Resolution] PR #123 ready' },
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
      tool_input: { text: '[Resolution] PR #123 ready' },
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
      tool_input: { text: '[Resolution] PR #123 ready' },
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
        tool_input: { text: '[Resolution] PR #123 ready' },
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
      tool_input: { text: '[Resolution] PR #123 ready' },
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

  it('blocks delivery when edits happened after the last critique (stale approve)', () => {
    activateWithStages(['OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 1,
        critique_stages: { OUTPUT_REVIEW: 1 },
        critique_verdicts: { OUTPUT_REVIEW: 'approve' },
        edits_since_critique: 2,
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] PR #123 ready' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('edit(s) recorded since the last critique');
  });

  it('CRITIQUE_FRESHNESS=0 disables the staleness check', () => {
    activateWithStages(['OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 1,
        critique_stages: { OUTPUT_REVIEW: 1 },
        critique_verdicts: { OUTPUT_REVIEW: 'approve' },
        edits_since_critique: 2,
      }),
    );
    const result = run(
      {
        tool_name: 'mcp__nanoclaw__send_message',
        tool_input: { text: '[Resolution] PR #123 ready' },
      },
      { CRITIQUE_FRESHNESS: '0' },
    );
    expect(result.status).toBe(0);
  });

  it('blocks delivery when an attested artifact changed after the approve', () => {
    const crypto = require('crypto') as typeof import('crypto');
    const artifact = path.join(tmpRoot, 'report.md');
    fs.writeFileSync(artifact, 'reviewed content\n');
    const goodHash = crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
    activateWithStages(['OUTPUT_REVIEW']);
    const state = {
      critique_rounds: 1,
      critique_stages: { OUTPUT_REVIEW: 1 },
      critique_verdicts: { OUTPUT_REVIEW: 'approve' },
      critique_attested: { OUTPUT_REVIEW: { [artifact]: goodHash } },
    };
    fs.writeFileSync(stateFile, JSON.stringify(state));
    // Matching hash → passes.
    const ok = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] ready' } },
      { CRITIQUE_ATTEST_ROOT: tmpRoot },
    );
    expect(ok.status).toBe(0);
    // Mutate the reviewed artifact → the stale approve must not ship.
    fs.appendFileSync(artifact, 'sneaky post-review edit\n');
    const blocked = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] ready' } },
      { CRITIQUE_ATTEST_ROOT: tmpRoot },
    );
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain('reviewed artifacts changed');
  });

  it('attested paths outside the attest root are ignored; CRITIQUE_ATTEST=0 disables', () => {
    activateWithStages(['OUTPUT_REVIEW']);
    const state = {
      critique_rounds: 1,
      critique_stages: { OUTPUT_REVIEW: 1 },
      critique_verdicts: { OUTPUT_REVIEW: 'approve' },
      critique_attested: {
        OUTPUT_REVIEW: { '/etc/passwd': 'f'.repeat(64), [path.join(tmpRoot, 'gone.md')]: 'e'.repeat(64) },
      },
    };
    fs.writeFileSync(stateFile, JSON.stringify(state));
    // Outside-root path ignored; the in-root missing file still trips the check…
    const blocked = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] ready' } },
      { CRITIQUE_ATTEST_ROOT: tmpRoot },
    );
    expect(blocked.status).toBe(2);
    expect(blocked.stderr).toContain('missing');
    expect(blocked.stderr).not.toContain('/etc/passwd');
    // …and the kill switch bypasses it entirely.
    const off = run(
      { tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] ready' } },
      { CRITIQUE_ATTEST_ROOT: tmpRoot, CRITIQUE_ATTEST: '0' },
    );
    expect(off.status).toBe(0);
  });

  it('does not enforce verdict for stages other than PLAN_REVIEW / OUTPUT_REVIEW', () => {
    activateWithStages(['DIAGNOSIS_REVIEW', 'CODE_REVIEW', 'DECISION_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { DIAGNOSIS_REVIEW: 1, CODE_REVIEW: 1, DECISION_REVIEW: 1 },
        critique_verdicts: { DIAGNOSIS_REVIEW: 'must-fix', CODE_REVIEW: 'must-fix', DECISION_REVIEW: 'must-fix' },
      }),
    );
    const result = run({
      tool_name: 'mcp__nanoclaw__send_message',
      tool_input: { text: '[Resolution] PR #123 ready' },
    });
    expect(result.status).toBe(0);
  });
});

describe('PLAN_REVIEW verdict gate (fixer path)', () => {
  // A must-fix plan review — e.g. "maintainer requirement dropped" — used to
  // block nothing: only its count was checked.
  const FIXER_STAGES = ['PLAN_REVIEW', 'CODE_REVIEW', 'OUTPUT_REVIEW'];

  function activateWithStages(stages: string[]): void {
    fs.writeFileSync(markerFile, 'critique-gate\n');
    fs.writeFileSync(path.join(overlayDir, '.critique-required-stages'), JSON.stringify(stages));
  }

  function state(verdicts: Record<string, string>): void {
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { PLAN_REVIEW: 1, CODE_REVIEW: 1, OUTPUT_REVIEW: 1 },
        critique_verdicts: verdicts,
      }),
    );
  }

  const deliver = (env: Record<string, string> = {}) =>
    run({ tool_name: 'mcp__nanoclaw__send_message', tool_input: { text: '[Resolution] PR #123 ready' } }, env);

  it('denies delivery when PLAN_REVIEW last verdict is must-fix (even with OUTPUT_REVIEW approved)', () => {
    activateWithStages(FIXER_STAGES);
    state({ PLAN_REVIEW: 'must-fix', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    const result = deliver();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PLAN_REVIEW last verdict is "must-fix" (must be "approve")');
    expect(result.stderr).toContain('Re-run /codex-critique with STAGE: PLAN_REVIEW after fixing');
  });

  it('denies gh pr create on a must-fix PLAN_REVIEW', () => {
    activateWithStages(FIXER_STAGES);
    state({ PLAN_REVIEW: 'must-fix', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    const result = run({ tool_name: 'Bash', tool_input: { command: 'gh pr create --title foo' } });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PLAN_REVIEW');
  });

  it('passes when PLAN_REVIEW and OUTPUT_REVIEW are approve', () => {
    activateWithStages(FIXER_STAGES);
    state({ PLAN_REVIEW: 'approve', CODE_REVIEW: 'must-fix', OUTPUT_REVIEW: 'approve' });
    expect(deliver().status).toBe(0);
  });

  it('fails closed when PLAN_REVIEW ran but no verdict was recorded', () => {
    activateWithStages(FIXER_STAGES);
    state({ CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    const result = deliver();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PLAN_REVIEW ran but no verdict was recorded');
  });

  it('CRITIQUE_VERDICT_STRICT=0 lets a missing PLAN_REVIEW verdict through (but not a must-fix)', () => {
    activateWithStages(FIXER_STAGES);
    state({ CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    expect(deliver({ CRITIQUE_VERDICT_STRICT: '0' }).status).toBe(0);
    state({ PLAN_REVIEW: 'must-fix', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    expect(deliver({ CRITIQUE_VERDICT_STRICT: '0' }).status).toBe(2);
  });

  it('groups without PLAN_REVIEW in their required stages are unaffected', () => {
    activateWithStages(['DECISION_REVIEW', 'OUTPUT_REVIEW']);
    fs.writeFileSync(
      stateFile,
      JSON.stringify({
        critique_rounds: 3,
        critique_stages: { PLAN_REVIEW: 1, DECISION_REVIEW: 1, OUTPUT_REVIEW: 1 },
        critique_verdicts: { PLAN_REVIEW: 'must-fix', DECISION_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' },
      }),
    );
    expect(deliver().status).toBe(0);
  });

  it('host env CRITIQUE_REQUIRED_STAGES decides whether the PLAN_REVIEW verdict is gated', () => {
    activateWithStages(['DECISION_REVIEW', 'OUTPUT_REVIEW']);
    state({ PLAN_REVIEW: 'must-fix', CODE_REVIEW: 'approve', OUTPUT_REVIEW: 'approve' });
    const result = deliver({ CRITIQUE_GATE_ACTIVE: '1', CRITIQUE_REQUIRED_STAGES: JSON.stringify(FIXER_STAGES) });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('PLAN_REVIEW last verdict');
  });
});
