// Regression guard for the jq filter in container/agent-runner/scripts/buddy-call.sh.
//
// The filter is in a SINGLE-quoted bash heredoc, so backslashes pass to jq
// verbatim. At expression level (inside `\(...)` interpolation) we MUST use
// bare `"..."` for string literals — `\"...\"` is a jq compile error there.
// Earlier versions had `\"<unknown>\"`, `\"\"`, `\"?\"` at expression level,
// causing jq exit 3 on every fire. set -euo pipefail then killed the script
// before any log_event call, so spawn-buddy.sh's nohup'd child died silently
// and log.jsonl stayed 0 bytes. Buddy guidance never appeared.
//
// This test extracts the filter from the live script and runs it through jq
// against a representative JSONL payload. If anyone reintroduces the bad
// escape pattern, jq exits 3 and this test fails loudly.

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(process.cwd(), 'container', 'agent-runner', 'scripts', 'buddy-call.sh');

function extractDistillFilter(): string {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  // The filter is bracketed by `jq -rc '` and the matching closing `'`
  // immediately before `2>/dev/null | head -12)`. Match non-greedily.
  const m = src.match(/jq -rc '([^']*(?:\\'[^']*)*)'\s*2>\/dev\/null \| head -12/);
  if (!m) {
    throw new Error('Could not extract jq filter from buddy-call.sh — file structure changed?');
  }
  return m[1];
}

function runJq(filter: string, input: string): { status: number; stdout: string; stderr: string } {
  const proc = spawnSync('jq', ['-rc', filter], { input, encoding: 'utf-8' });
  return { status: proc.status ?? -1, stdout: proc.stdout ?? '', stderr: proc.stderr ?? '' };
}

describe('buddy-call.sh distill jq filter', () => {
  const filter = extractDistillFilter();

  it('filter compiles (no expression-level \\" escape)', () => {
    // Use a minimal valid JSONL line — focus is the COMPILE step, not output.
    const r = runJq(filter, '{}\n');
    // jq exit 1 = no matching output (acceptable). exit 3 = compile error (the bug).
    expect(r.status, `jq stderr: ${r.stderr}`).not.toBe(3);
    // Negative match for the historical bug pattern
    expect(r.stderr).not.toContain('Unix shell quoting issues');
  });

  it('Bash tool_use produces a [Bash] line', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: 'ls /tmp' } }] },
    });
    const r = runJq(filter, jsonl + '\n');
    expect(r.status, `jq stderr: ${r.stderr}`).toBe(0);
    expect(r.stdout.trim()).toBe('[Bash] ls /tmp');
  });

  it('Edit tool_use produces an [Edit] line with file_path', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/workspace/foo.ts' } }],
      },
    });
    const r = runJq(filter, jsonl + '\n');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('[Edit] /workspace/foo.ts');
  });

  it('Edit with no file_path falls back to "<unknown>" (literal — not the broken escape)', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit', input: {} }] },
    });
    const r = runJq(filter, jsonl + '\n');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('[Edit] <unknown>');
  });

  it('mcp__nanoclaw__send_message produces a one-line entry with to= and text=', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            name: 'mcp__nanoclaw__send_message',
            input: { to: 'slangy-triage', text: 'hello world' },
          },
        ],
      },
    });
    const r = runJq(filter, jsonl + '\n');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('[mcp__nanoclaw__send_message] to=slangy-triage text="hello world"');
  });

  it('read-only tools (Read/Grep/Glob/LS/WebSearch/WebFetch) are filtered out', () => {
    // jq without -e returns 0 even when no outputs — the script's behavior
    // is gated on empty stdout, not exit status. We assert the output is
    // empty AND the filter didn't compile-error (status != 3).
    const lines = ['Read', 'Grep', 'Glob', 'LS', 'WebSearch', 'WebFetch']
      .map((name) =>
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'tool_use', name, input: {} }] },
        }),
      )
      .join('\n');
    const r = runJq(filter, lines + '\n');
    expect(r.status, `jq stderr: ${r.stderr}`).not.toBe(3);
    expect(r.stdout).toBe('');
  });

  it('non-assistant entries are filtered out', () => {
    const lines = [
      JSON.stringify({ type: 'queue-operation', operation: 'enqueue' }),
      JSON.stringify({ type: 'user', message: { content: 'hi' } }),
      JSON.stringify({ type: 'attachment', attachment: { type: 'skill_listing' } }),
    ].join('\n');
    const r = runJq(filter, lines + '\n');
    expect(r.status, `jq stderr: ${r.stderr}`).not.toBe(3);
    expect(r.stdout).toBe('');
  });

  it('mixed batch — 1 Bash + 1 Read + 1 user — yields exactly one Bash line', () => {
    const lines = [
      JSON.stringify({ type: 'user', message: { content: 'go' } }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: '/etc' } }] },
      }),
      JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'Bash', input: { command: 'echo hi' } }],
        },
      }),
    ].join('\n');
    const r = runJq(filter, lines + '\n');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('[Bash] echo hi');
  });
});

// codex 0.124+ changed --json output shape: `thread.started` events with
// `thread_id` (was top-level `session_id`) and `item.completed`/`agent_message`
// items (was top-level `agent_message` events). Earlier buddy-call.sh used
// stale selectors so thread-id was never extracted, every fire was a fresh
// `codex exec` init, and ledger continuity was lost across batches.
function extractThreadIdSelector(): string {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  // The selector lives inside extract_thread_id(). Match between
  // `extract_thread_id() {` and the closing `}` (single-quoted jq inside).
  const m = src.match(/extract_thread_id\(\)\s*\{\s*jq -r '([^']*)'/);
  if (!m) throw new Error('Could not extract thread-id jq selector from buddy-call.sh');
  return m[1];
}
function extractResponseSelector(): string {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  const m = src.match(/extract_response\(\)\s*\{\s*[^j]*jq -r '([\s\S]*?)'\s*2>/);
  if (!m) throw new Error('Could not extract response jq selector from buddy-call.sh');
  return m[1];
}

describe('buddy-call.sh codex --json event-shape selectors (v0.124+ + back-compat)', () => {
  const threadIdFilter = extractThreadIdSelector();
  const responseFilter = extractResponseSelector();

  // Real codex 0.124 events captured live from `codex exec --json`:
  const newShapeEvents = [
    JSON.stringify({ type: 'thread.started', thread_id: '019e555c-a6f4-7990-b8cb-3807ddc2176f' }),
    JSON.stringify({ type: 'turn.started' }),
    JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'Confirmed — I can read this.' },
    }),
    JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 5 } }),
  ].join('\n');

  it('thread_id extraction: pulls thread_id from {type:"thread.started",thread_id:"…"}', () => {
    const r = runJq(threadIdFilter, newShapeEvents + '\n');
    expect(r.status).not.toBe(3);
    expect(r.stdout.trim()).toBe('019e555c-a6f4-7990-b8cb-3807ddc2176f');
  });

  it('thread_id extraction: back-compat with old shape {session_id:"…"}', () => {
    const oldShape = JSON.stringify({ session_id: 'old-uuid', type: 'session.started' });
    const r = runJq(threadIdFilter, oldShape + '\n');
    expect(r.stdout.trim()).toBe('old-uuid');
  });

  it('thread_id extraction: empty input → empty output, no error', () => {
    const r = runJq(threadIdFilter, '{}\n');
    expect(r.status).not.toBe(3);
    expect(r.stdout.trim()).toBe('');
  });

  it('response extraction: pulls .item.text from item.completed/agent_message', () => {
    const r = runJq(responseFilter, newShapeEvents + '\n');
    expect(r.status).not.toBe(3);
    expect(r.stdout.trim()).toBe('Confirmed — I can read this.');
  });

  it('response extraction: when multiple agent_messages emit, the SCRIPT-side `| tail -1` picks the last', () => {
    // The selector itself outputs every match; the script applies `| tail -1`
    // around it to pick the final one. Mirror that here so the test pins
    // end-to-end behavior, not just the raw jq.
    const multi = [
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'first thinking' } }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'final answer' } }),
    ].join('\n');
    const r = runJq(responseFilter, multi + '\n');
    const lastLine = r.stdout.trim().split('\n').pop();
    expect(lastLine).toBe('final answer');
  });

  it('response extraction: back-compat with old top-level {type:"agent_message",message:"…"}', () => {
    const old = JSON.stringify({ type: 'agent_message', message: 'old shape body' });
    const r = runJq(responseFilter, old + '\n');
    expect(r.stdout.trim()).toBe('old shape body');
  });

  it('response extraction: ignores non-agent items (turn.started, tool_use, etc.)', () => {
    const noisy = [
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.completed', item: { type: 'tool_use', name: 'bash' } }),
      JSON.stringify({ type: 'turn.completed' }),
    ].join('\n');
    const r = runJq(responseFilter, noisy + '\n');
    expect(r.status).not.toBe(3);
    expect(r.stdout.trim()).toBe('');
  });

  it('codex flags: resume invocation uses -c sandbox_mode (no -s, no -C)', () => {
    // Ground truth from `codex exec resume --help` on v0.124: -s and -C are
    // not accepted on resume. Pin the flag string we built so a future
    // refactor can't quietly reintroduce them.
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    expect(src).toContain('CODEX_FLAGS="-c sandbox_mode=danger-full-access --skip-git-repo-check"');
    // Defensive: the literal `-s danger-full-access` must NOT appear (it
    // breaks resume even though codex exec accepts it; uniformity is safer).
    expect(src).not.toMatch(/codex exec[^\n]*-s\s+danger-full-access/);
  });
});

describe('buddy-call.sh SDK-flush race fix (#68)', () => {
  // PostToolUse fires BEFORE the Claude Agent SDK flushes the tool_use
  // entry that triggered it. The script needs to WAIT for JSONL to grow
  // past cursor before reading, otherwise distill is empty, cursor
  // advances, and subsequent fires see no-new-bytes — that whole tool
  // batch escapes review.
  const scriptSrc = fs.readFileSync(SCRIPT_PATH, 'utf8');

  it('wait loop polls JSONL size against cursor (not just sleep + read once)', () => {
    // The fix has to be a polling loop, not a fixed sleep — fixed sleep
    // either wastes time or under-waits. Pin the structural shape:
    expect(scriptSrc).toMatch(/CUR_SIZE=\$\(stat -c %s "\$JSONL"/);
    expect(scriptSrc).toMatch(/CUR_SIZE.*-gt.*WAIT_LAST.*break/s);
  });

  it('wait loop has a budget (configurable, with sane default)', () => {
    // Without a budget the script could hang forever if the SDK never
    // writes (e.g., crashed agent). Pin the env-var override too — it's
    // the test/debug seam.
    expect(scriptSrc).toContain('BUDDY_FLUSH_WAIT_BUDGET_DECISECONDS');
    expect(scriptSrc).toMatch(/WAIT_BUDGET=.*BUDDY_FLUSH_WAIT_BUDGET_DECISECONDS:-30/);
  });

  it('wait runs AFTER lock acquisition (so concurrent fires bail with lock-busy, not stack waits)', () => {
    // Order matters: if the wait ran before the lock, every concurrent
    // PostToolUse would each wait 3s independently — wasteful and creates
    // a thundering herd on JSONL stat. Lock first, then the single owner
    // waits.
    const lockIdx = scriptSrc.indexOf('touch "$LOCK"');
    const waitIdx = scriptSrc.indexOf('WAIT_LAST=$(cat "$CURSOR"');
    expect(lockIdx).toBeGreaterThan(0);
    expect(waitIdx).toBeGreaterThan(lockIdx);
  });

  it('wait does NOT advance cursor on its own (cursor write only after distill decision)', () => {
    // The wait is read-only — it doesn't write CURSOR. Otherwise it could
    // skip content if the SDK writes between the wait check and the
    // distill read. Verify CURSOR write only appears AFTER the wait
    // section.
    const waitIdx = scriptSrc.indexOf('WAIT_LAST=$(cat "$CURSOR"');
    expect(waitIdx).toBeGreaterThan(0);
    const earlyCursorWrite = scriptSrc.slice(0, waitIdx).match(/echo .* > "\$CURSOR"/);
    expect(earlyCursorWrite).toBeNull();
  });
});
