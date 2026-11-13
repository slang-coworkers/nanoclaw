import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import nanoclawHooks, { claudeToolInput, claudeToolName } from './nanoclaw-hooks.js';
import { piExtensions } from '../pi.js';

// Fork-owned. Pi never reads the Claude Code hook settings the host writes, so
// without this extension every Bash gate (critique before a PR, PR text, eval
// sandbox, plan gate, git guards) is off in a Pi group.

let dir: string;
type Handler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<unknown>;
let handlers: Record<string, Handler>;
const ctx = { cwd: '/workspace/agent', sessionManager: { getSessionId: () => 'pi-session-1' } };

function load(hooks: Record<string, unknown>): void {
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ hooks }));
  process.env.NANOCLAW_HOOK_SETTINGS = file;
  handlers = {};
  nanoclawHooks({ on: (event: string, handler: Handler) => void (handlers[event] = handler) } as never);
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-hooks-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.NANOCLAW_HOOK_SETTINGS;
  delete process.env.NANOCLAW_ALLOW_ISSUE_CLOSE;
});

describe('Pi tools as Claude Code tools', () => {
  it('maps the built-in tool names and keeps any other name', () => {
    expect(['bash', 'read', 'edit', 'write', 'grep', 'find', 'ls'].map(claudeToolName)).toEqual([
      'Bash',
      'Read',
      'Edit',
      'Write',
      'Grep',
      'Glob',
      'LS',
    ]);
    expect(claudeToolName('mcp')).toBe('mcp');
  });

  it('gives file tools an absolute file_path and an edit the old_string/new_string pair', () => {
    expect(
      claudeToolInput('edit', { path: 'CLAUDE.md', edits: [{ oldText: 'a', newText: 'b' }] }, '/workspace/agent'),
    ).toEqual({
      path: 'CLAUDE.md',
      file_path: '/workspace/agent/CLAUDE.md',
      edits: [{ old_string: 'a', new_string: 'b' }],
      old_string: 'a',
      new_string: 'b',
    });
    const two = claudeToolInput('edit', { path: '/x', edits: [{ oldText: 'a' }, { oldText: 'c' }] }, '/w');
    expect(two.old_string).toBeUndefined();
    expect(claudeToolInput('bash', { command: 'ls' }, '/w')).toEqual({ command: 'ls' });
  });
});

describe('the extension', () => {
  it('blocks gh pr create when the PreToolUse gate refuses it, with the gate reason', async () => {
    const gate = path.join(dir, 'gate.sh');
    fs.writeFileSync(
      gate,
      `grep -q 'gh pr create' && { echo 'CRITIQUE REQUIRED before PR creation' >&2; exit 2; }; exit 0\n`,
    );
    load({ PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: `bash ${gate}` }] }] });
    const blocked = await handlers.tool_call(
      { toolCallId: 't1', toolName: 'bash', input: { command: 'gh pr create -t x' } },
      ctx,
    );
    expect(blocked).toEqual({ block: true, reason: 'CRITIQUE REQUIRED before PR creation' });
    expect(
      await handlers.tool_call({ toolCallId: 't2', toolName: 'bash', input: { command: 'ls' } }, ctx),
    ).toBeUndefined();
    // The matcher selects by the Claude Code name: a write is not a Bash call.
    expect(
      await handlers.tool_call(
        { toolCallId: 't3', toolName: 'write', input: { path: 'a', content: 'gh pr create' } },
        ctx,
      ),
    ).toBeUndefined();
  });

  it('hands the hook the Claude Code payload', async () => {
    const seen = path.join(dir, 'seen.json');
    load({ PreToolUse: [{ matcher: 'Edit', hooks: [{ command: `cat > ${seen}` }] }] });
    await handlers.tool_call(
      { toolCallId: 't1', toolName: 'edit', input: { path: 'CLAUDE.md', edits: [{ oldText: 'a', newText: 'b' }] } },
      ctx,
    );
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8'))).toMatchObject({
      hook_event_name: 'PreToolUse',
      session_id: 'pi-session-1',
      tool_name: 'Edit',
      tool_input: { file_path: '/workspace/agent/CLAUDE.md', old_string: 'a', new_string: 'b' },
      tool_use_id: 't1',
    });
  });

  it('blocks an issue close before any hook runs, unless the group allows it', async () => {
    load({});
    const close = { toolCallId: 't1', toolName: 'bash', input: { command: 'gh issue close 5 -R o/r' } };
    expect(await handlers.tool_call(close, ctx)).toMatchObject({
      block: true,
      reason: expect.stringContaining('maintainer-only'),
    });
    process.env.NANOCLAW_ALLOW_ISSUE_CLOSE = '1';
    expect(await handlers.tool_call(close, ctx)).toBeUndefined();
  });

  it('runs PostToolUse hooks with the Bash result as stdout, as pr-auto-map.sh reads it', async () => {
    const seen = path.join(dir, 'post.json');
    load({ PostToolUse: [{ matcher: 'Bash', hooks: [{ command: `cat > ${seen}` }] }] });
    await handlers.tool_result(
      {
        toolCallId: 't1',
        toolName: 'bash',
        input: { command: 'gh pr create -t x' },
        content: [{ type: 'text', text: 'https://github.com/o/r/pull/9\n' }],
        isError: false,
      },
      ctx,
    );
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8'))).toMatchObject({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create -t x' },
      tool_response: { stdout: 'https://github.com/o/r/pull/9\n', stderr: '' },
    });
  });
});

describe('wiring', () => {
  it('pi loads the hooks extension next to the context extension and the MCP adapter', () => {
    const list = piExtensions({ PI_MCP_ADAPTER_ENTRY: '/opt/pi-mcp-adapter/index.ts' });
    expect(list.map((p) => path.basename(p))).toEqual(['nanoclaw-context.ts', 'nanoclaw-hooks.ts', 'index.ts']);
    expect(list.every((p) => path.isAbsolute(p) && (p.startsWith('/opt') || fs.existsSync(p)))).toBe(true);
  });
});
