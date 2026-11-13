import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import {
  codexHookEntries,
  hookScriptName,
  mcpHandshake,
  overlayMarkers,
  secretModes,
  settingsHookEntries,
  workflowSummary,
} from './coworker-checks.js';

describe('hookScriptName', () => {
  it('skips env assignments and the interpreter', () => {
    expect(hookScriptName('OVERLAY_HAS_PLAN=1 bash /app/hooks/gate-plan.sh')).toBe('gate-plan.sh');
    expect(hookScriptName('bun /app/src/issue-close-hook.ts')).toBe('issue-close-hook.ts');
    expect(hookScriptName('bash /app/hooks/codex-dashboard-hook.sh PreToolUse')).toBe('codex-dashboard-hook.sh');
    expect(hookScriptName('/app/hooks/track-edits.sh')).toBe('track-edits.sh');
  });
});

describe('settingsHookEntries', () => {
  it('lists each command with its event and matcher', () => {
    const settings = {
      hooks: {
        PreToolUse: [
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'bash /app/hooks/gate-critique-on-deliver.sh' }] },
          {
            matcher: 'Edit|Write|Bash',
            hooks: [{ type: 'command', command: 'OVERLAY_HAS_PLAN=1 bash /app/hooks/gate-plan.sh' }],
          },
        ],
        Stop: [{ hooks: [{ type: 'command', command: 'bash /app/hooks/gate-explain-on-stop.sh' }] }],
      },
    };
    expect(settingsHookEntries(settings)).toEqual([
      { event: 'PreToolUse', matcher: 'Bash', script: 'gate-critique-on-deliver.sh' },
      { event: 'PreToolUse', matcher: 'Edit|Write|Bash', script: 'gate-plan.sh' },
      { event: 'Stop', matcher: null, script: 'gate-explain-on-stop.sh' },
    ]);
  });

  it('returns nothing for a missing or malformed file', () => {
    expect(settingsHookEntries(null)).toEqual([]);
    expect(settingsHookEntries({ hooks: 'x' })).toEqual([]);
    expect(settingsHookEntries({ hooks: { PreToolUse: [{ hooks: [{ command: 3 }] }] } })).toEqual([]);
  });
});

describe('codexHookEntries', () => {
  it('reads events, matchers and commands, and stops at another table', () => {
    const toml = [
      '[features]',
      'hooks = true',
      '[[hooks.PreToolUse]]',
      'matcher = "Bash"',
      '  [[hooks.PreToolUse.hooks]]',
      '  type = "command"',
      '  command = "bash /app/hooks/gate-plan.sh"',
      '[[hooks.Stop]]',
      '  [[hooks.Stop.hooks]]',
      '  command = "bash /app/hooks/codex-dashboard-hook.sh Stop"',
      '[permissions]',
      'command = "not a hook"',
    ].join('\n');
    expect(codexHookEntries(toml)).toEqual([
      { event: 'PreToolUse', matcher: 'Bash', script: 'gate-plan.sh' },
      { event: 'Stop', matcher: null, script: 'codex-dashboard-hook.sh' },
    ]);
  });

  it('reads the hook file the image carries', () => {
    const toml = readFileSync(join(process.cwd(), 'container', 'codex-hooks.toml'), 'utf-8');
    const entries = codexHookEntries(toml);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((e) => e.script.length > 0)).toBe(true);
  });
});

describe('overlayMarkers', () => {
  it('turns marker files into overlay names', () => {
    expect(overlayMarkers(['CLAUDE.md', '.overlay-plan-gate', '.overlay-critique-gate', '.overlay-'])).toEqual([
      'critique-gate',
      'plan-gate',
    ]);
  });
});

describe('workflowSummary', () => {
  it('keeps the fields an operator reads', () => {
    expect(
      workflowSummary({
        task_id: 'task-1',
        plan_written: true,
        plan_path: '/workspace/agent/reports/p.md',
        critique_rounds: 2,
        edits_since_plan: 4,
        started_at: '2026-11-13T07:00:00Z',
        extra: 'ignored',
      }),
    ).toEqual({
      taskId: 'task-1',
      planWritten: true,
      planPath: '/workspace/agent/reports/p.md',
      critiqueRounds: 2,
      editsSincePlan: 4,
      startedAt: '2026-11-13T07:00:00Z',
    });
  });

  it('is null when there is no state', () => {
    expect(workflowSummary(null)).toBeNull();
    expect(workflowSummary([])).toBeNull();
  });
});

describe('secretModes', () => {
  it('maps each group to its OneCLI mode and never returns the access token', () => {
    const agents = [
      { id: 'u1', identifier: 'ag-1', secretMode: 'selective', accessToken: 'secret-1' },
      { id: 'u2', identifier: 'ag-2', secretMode: 'all', accessToken: 'secret-2' },
    ];
    const rows = secretModes(agents, [
      { id: 'ag-2', folder: 'beta' },
      { id: 'ag-1', folder: 'alpha' },
      { id: 'ag-3', folder: 'gamma' },
    ]);
    expect(rows).toEqual([
      { groupId: 'ag-1', folder: 'alpha', mode: 'selective' },
      { groupId: 'ag-2', folder: 'beta', mode: 'all' },
      { groupId: 'ag-3', folder: 'gamma', mode: 'missing' },
    ]);
    expect(JSON.stringify(rows)).not.toContain('secret-');
  });
});

describe('mcpHandshake', () => {
  const clock = () => {
    let t = 0;
    return () => (t += 600);
  };

  it('times initialize and ends the session it opened', async () => {
    const calls: { method: string; session?: string }[] = [];
    const fetchImpl = async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ method: String(init.method), session: headers['Mcp-Session-Id'] });
      if (init.method === 'DELETE') return new Response(null, { status: 200 });
      return new Response('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n', {
        status: 200,
        headers: { 'mcp-session-id': 's-1' },
      });
    };
    const r = await mcpHandshake('slang-mcp', 8920, { fetchImpl, now: clock() });
    expect(r).toEqual({ name: 'slang-mcp', port: 8920, ms: 600, ok: true });
    expect(calls).toEqual([
      { method: 'POST', session: undefined },
      { method: 'DELETE', session: 's-1' },
    ]);
  });

  it('reports an HTTP error and a missing result', async () => {
    const http = await mcpHandshake('a', 1, {
      fetchImpl: async () => new Response('nope', { status: 502 }),
      now: clock(),
    });
    expect(http).toMatchObject({ ok: false, error: 'HTTP 502' });
    const empty = await mcpHandshake('b', 2, { fetchImpl: async () => new Response('{}'), now: clock() });
    expect(empty).toMatchObject({ ok: false, error: 'no initialize result' });
  });

  it('reports a timeout without a time', async () => {
    const fetchImpl = async () => {
      const err = new Error('The operation was aborted due to timeout');
      err.name = 'TimeoutError';
      throw err;
    };
    expect(await mcpHandshake('slow', 3, { fetchImpl })).toEqual({
      name: 'slow',
      port: 3,
      ms: null,
      ok: false,
      error: 'timed out',
    });
  });
});
