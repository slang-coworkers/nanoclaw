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

const SCRIPT_PATH = path.resolve(
  process.cwd(),
  'container',
  'agent-runner',
  'scripts',
  'buddy-call.sh',
);

function extractDistillFilter(): string {
  const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
  // The filter is bracketed by `jq -rc '` and the matching closing `'`
  // immediately before `2>/dev/null | head -12)`. Match non-greedily.
  const m = src.match(/jq -rc '([^']*(?:\\'[^']*)*)'\s*2>\/dev\/null \| head -12/);
  if (!m) {
    throw new Error("Could not extract jq filter from buddy-call.sh — file structure changed?");
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
