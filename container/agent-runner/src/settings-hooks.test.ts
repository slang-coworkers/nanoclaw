import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { hookOutcome, matcherSelects, runHookEvent, type HookSettings } from './settings-hooks.js';

// Fork-owned. The OpenCode hook bridge and the runner's Stop hooks run the
// group's settings.json hooks through this module, so it must read them the way
// Claude Code does.

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-hooks-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('Claude Code hook semantics', () => {
  it('selects tools the way a Claude Code matcher does', () => {
    expect(matcherSelects('', 'Bash')).toBe(true);
    expect(matcherSelects('*', 'Edit')).toBe(true);
    expect(matcherSelects('mcp__nanoclaw__send_message|Bash', 'Bash')).toBe(true);
    expect(matcherSelects('mcp__nanoclaw__send_message|Bash', 'Edit')).toBe(false);
    expect(matcherSelects('Bash', 'BashOutput')).toBe(false);
  });

  it('blocks on exit 2 or a JSON deny, and not on other results', () => {
    expect(hookOutcome(2, '', 'need a critique\n')).toEqual({ block: true, reason: 'need a critique' });
    expect(
      hookOutcome(
        0,
        JSON.stringify({ hookSpecificOutput: { permissionDecision: 'deny', permissionDecisionReason: 'no' } }),
        '',
      ),
    ).toEqual({ block: true, reason: 'no' });
    expect(hookOutcome(0, JSON.stringify({ decision: 'block', reason: 'stop' }), '')).toEqual({
      block: true,
      reason: 'stop',
    });
    expect(hookOutcome(0, 'plain text', '').block).toBe(false);
    expect(hookOutcome(1, '', 'hook crashed').block).toBe(false);
  });

  it('runs only the hooks whose matcher selects the tool, and skips commands another path runs', async () => {
    const marker = path.join(dir, 'ran');
    const settings: HookSettings = {
      PreToolUse: [
        { matcher: 'Edit', hooks: [{ type: 'command', command: `touch ${marker}-edit` }] },
        {
          matcher: 'Bash',
          hooks: [{ type: 'command', command: `grep -q deny-me && { echo refused >&2; exit 2; } || true` }],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            { command: `touch ${marker}-router # /app/hooks/intent-router.sh` },
            { command: `touch ${marker}-reset` },
          ],
        },
      ],
    };
    expect((await runHookEvent(settings, 'PreToolUse', 'Bash', { tool_input: { command: 'ls' } })).block).toBe(false);
    expect(await runHookEvent(settings, 'PreToolUse', 'Bash', { tool_input: { command: 'deny-me' } })).toEqual({
      block: true,
      reason: 'refused',
    });
    expect(fs.existsSync(`${marker}-edit`)).toBe(false);
    await runHookEvent(settings, 'UserPromptSubmit', '', { prompt: 'hi' }, { skip: /\/intent-router\.sh\b/ });
    expect(fs.existsSync(`${marker}-router`)).toBe(false);
    expect(fs.existsSync(`${marker}-reset`)).toBe(true);
  });
});

describe('Stop events', () => {
  it('runs every Stop entry, whatever its matcher says, as Claude Code does', async () => {
    const marker = path.join(dir, 'stop');
    const settings: HookSettings = { Stop: [{ matcher: 'Bash', hooks: [{ command: `touch ${marker}` }] }] };
    expect((await runHookEvent(settings, 'Stop', '', { stop_hook_active: false })).block).toBe(false);
    expect(fs.existsSync(marker)).toBe(true);
  });

  it('runs the telemetry hook even when the gate before it blocks, and joins the reasons', async () => {
    const seen = path.join(dir, 'telemetry.json');
    const settings: HookSettings = {
      Stop: [
        { hooks: [{ command: `echo '{"decision":"block","reason":"refresh the explanation"}'` }] },
        { hooks: [{ command: `cat > ${seen}` }] },
        { hooks: [{ command: `echo 'second gate' >&2; exit 2` }] },
      ],
    };
    const outcome = await runHookEvent(settings, 'Stop', '', { session_id: 's1', stop_hook_active: false });
    expect(outcome).toEqual({ block: true, reason: 'refresh the explanation\n\nsecond gate' });
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8'))).toMatchObject({
      hook_event_name: 'Stop',
      session_id: 's1',
      stop_hook_active: false,
    });
  });
});

describe('tool events', () => {
  it('a refused tool call still reaches the telemetry hook registered after the gate', async () => {
    const seen = path.join(dir, 'pre-telemetry.json');
    const settings: HookSettings = {
      PreToolUse: [
        { matcher: 'Write', hooks: [{ command: `echo 'PLAN REQUIRED' >&2; exit 2` }] },
        { hooks: [{ command: `cat > ${seen}` }] },
      ],
    };
    const outcome = await runHookEvent(settings, 'PreToolUse', 'Write', {
      tool_name: 'Write',
      tool_input: { file_path: '/workspace/agent/x.py' },
    });
    expect(outcome).toEqual({ block: true, reason: 'PLAN REQUIRED' });
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8'))).toMatchObject({
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
    });
  });
});
