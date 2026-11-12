import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  NanoclawHookBridge,
  claudeToolInput,
  claudeToolName,
  claudeToolResponse,
  hookOutcome,
  installOpenCodeHookBridge,
  matcherSelects,
  runHookEvent,
  type HookSettings,
} from './opencode-hook-bridge.js';

// Fork-owned. OpenCode never reads the Claude Code hook settings the host
// writes, so without this bridge every gate (critique, plan, eval sandbox, PR
// checks) is off in an OpenCode group. These tests pin the event mapping and the
// block semantics the gate scripts rely on.

const SERVERS = ['nanoclaw', 'codex', 'slang', 'slang-mcp'];
let dir: string;

function script(name: string, body: string): string {
  const file = path.join(dir, name);
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  return file;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-hook-bridge-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.NANOCLAW_HOOK_SETTINGS;
  delete process.env.OPENCODE_CONFIG_CONTENT;
  delete process.env.NANOCLAW_ALLOW_ISSUE_CLOSE;
});

describe('tool names and inputs', () => {
  it('maps built-in tools and MCP tools to their Claude Code names', () => {
    expect(claudeToolName('bash', SERVERS)).toBe('Bash');
    expect(claudeToolName('edit', SERVERS)).toBe('Edit');
    expect(claudeToolName('nanoclaw_send_message', SERVERS)).toBe('mcp__nanoclaw__send_message');
    expect(claudeToolName('codex_codex', SERVERS)).toBe('mcp__codex__codex');
    // The longest server name wins, so a server name with the separator in it maps whole.
    expect(claudeToolName('slang-mcp_github_get_issue', SERVERS)).toBe('mcp__slang-mcp__github_get_issue');
    expect(claudeToolName('unknown_tool', SERVERS)).toBe('unknown_tool');
  });

  it('renames camelCase built-in arguments and keeps MCP arguments as they are', () => {
    expect(claudeToolInput('Edit', { filePath: '/a', oldString: 'x', newString: 'y' })).toEqual({
      file_path: '/a',
      old_string: 'x',
      new_string: 'y',
    });
    expect(claudeToolInput('mcp__codex__codex', { prompt: 'p', threadId: 't' })).toEqual({
      prompt: 'p',
      threadId: 't',
    });
  });
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
    await runHookEvent(settings, 'UserPromptSubmit', '', { prompt: 'hi' }, /\/intent-router\.sh\b/);
    expect(fs.existsSync(`${marker}-router`)).toBe(false);
    expect(fs.existsSync(`${marker}-reset`)).toBe(true);
  });
});

describe('the OpenCode plugin', () => {
  async function plugin(settings: HookSettings) {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(file, JSON.stringify({ hooks: settings }));
    process.env.NANOCLAW_HOOK_SETTINGS = file;
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ mcp: { nanoclaw: {}, codex: {} } });
    return NanoclawHookBridge();
  }

  it('blocks a delivery marker on the NanoClaw MCP tool when the PreToolUse gate refuses it', async () => {
    const gate = script(
      'gate.sh',
      `grep -q 'Review Verdict' && { echo 'run /codex-critique first' >&2; exit 2; }; exit 0`,
    );
    const hooks = await plugin({
      PreToolUse: [{ matcher: 'mcp__nanoclaw__send_message|Bash', hooks: [{ command: gate }] }],
    });
    await expect(
      hooks['tool.execute.before'](
        { tool: 'nanoclaw_send_message', sessionID: 's1' },
        { args: { text: '[Review Verdict] x' } },
      ),
    ).rejects.toThrow('run /codex-critique first');
    await hooks['tool.execute.before'](
      { tool: 'nanoclaw_send_message', sessionID: 's1' },
      { args: { text: '[Report] x' } },
    );
  });

  it('blocks an issue close before any hook runs, unless the group allows it', async () => {
    const hooks = await plugin({});
    await expect(
      hooks['tool.execute.before']({ tool: 'bash' }, { args: { command: 'gh issue close 5 -R o/r' } }),
    ).rejects.toThrow('maintainer-only');
    process.env.NANOCLAW_ALLOW_ISSUE_CLOSE = '1';
    await hooks['tool.execute.before']({ tool: 'bash' }, { args: { command: 'gh issue close 5 -R o/r' } });
  });

  it('hands PostToolUse hooks the result in the shape Claude Code uses', async () => {
    const seen = path.join(dir, 'seen.json');
    const hooks = await plugin({
      PostToolUse: [{ matcher: '', hooks: [{ command: `cat >> ${seen}; echo >> ${seen}` }] }],
    });
    // OpenCode 1.18 passes a finished tool's arguments in `input`, not `output`.
    // track-critique.sh reads the STAGE marker from them; without them no
    // critique stage is recorded and the delivery gate can never pass.
    await hooks['tool.execute.after'](
      { tool: 'bash', args: { command: 'gh pr create' } },
      { output: 'https://github.com/o/r/pull/9\n' },
    );
    await hooks['tool.execute.after'](
      { tool: 'codex_codex', args: { prompt: 'STAGE: CODE_REVIEW' } },
      { content: [{ type: 'text', text: '### Verdict\napprove' }] },
    );
    const [bash, codex] = fs
      .readFileSync(seen, 'utf-8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(bash.tool_name).toBe('Bash');
    expect(bash.tool_input).toEqual({ command: 'gh pr create' });
    expect(bash.tool_response).toEqual({ stdout: 'https://github.com/o/r/pull/9\n', stderr: '' });
    expect(codex.tool_name).toBe('mcp__codex__codex');
    expect(codex.tool_input).toEqual({ prompt: 'STAGE: CODE_REVIEW' });
    expect(JSON.parse(codex.tool_response)).toEqual({ content: '### Verdict\napprove' });
    expect(codex.hook_event_name).toBe('PostToolUse');
  });

  it('appends a PostToolUse block reason to the tool output', async () => {
    const hooks = await plugin({
      PostToolUse: [{ matcher: 'Bash', hooks: [{ command: `echo 'add the explanation comment' >&2; exit 2` }] }],
    });
    const output = { args: { command: 'gh pr create' }, output: 'created' };
    await hooks['tool.execute.after']({ tool: 'bash' }, output);
    expect(output.output).toBe('created\n\nadd the explanation comment');
  });
});

describe('installation', () => {
  it('writes a plugin file that re-exports only the bridge', () => {
    const file = installOpenCodeHookBridge(dir, '/app/src/providers/opencode-hook-bridge.ts');
    expect(file).toBe(path.join(dir, 'opencode', 'plugin', 'nanoclaw-hook-bridge.js'));
    expect(fs.readFileSync(file, 'utf-8')).toBe(
      'export { NanoclawHookBridge } from "/app/src/providers/opencode-hook-bridge.ts";\n',
    );
  });
});

describe('payload guard', () => {
  // spawnOpencodeServer comes from the add-opencode payload. A payload refresh
  // that drops the install call turns every gate off again for OpenCode groups.
  it('starting the OpenCode server installs the bridge before the spawn', async () => {
    const { spawnOpencodeServer } = await import('./opencode.js');
    const saved = {
      PATH: process.env.PATH,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
      XDG_DATA_HOME: process.env.XDG_DATA_HOME,
    };
    process.env.PATH = dir; // no `opencode` binary here, so the spawn fails
    process.env.XDG_CONFIG_HOME = path.join(dir, 'config');
    process.env.XDG_DATA_HOME = path.join(dir, 'data');
    try {
      await expect(spawnOpencodeServer({}, 1000)).rejects.toThrow();
      expect(fs.existsSync(path.join(dir, 'config', 'opencode', 'plugin', 'nanoclaw-hook-bridge.js'))).toBe(true);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe('image guard', () => {
  // Without the plugin package in the image, OpenCode installs it at server start
  // and its API answers only after ~90 s (never offline), so a group's first turn
  // times out. Measured on lego: 99.5 s without the package, 11.5 s with it.
  it("the agent image ships @opencode-ai/plugin at the CLI version in OpenCode's config directory", () => {
    const dockerfile = fs.readFileSync(path.join(import.meta.dir, '..', '..', '..', 'Dockerfile'), 'utf-8');
    expect(dockerfile).toContain('v="$(opencode --version)"');
    expect(dockerfile).toContain('"@opencode-ai/plugin":"%s"');
    expect(dockerfile).toContain('mkdir -p /home/node/.config/opencode');
  });
});
