import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  NanoclawHookBridge,
  failedToolPart,
  claudeToolInput,
  claudeToolName,
  installOpenCodeHookBridge,
  settingsSessionHooks,
  type OpenCodeTodoClient,
} from './opencode-hook-bridge.js';
import { claudeToolResponse, type HookSettings } from '../settings-hooks.js';
import { createOpenCodeId } from './opencode-turn.js';
import { registerAgentMailbox, resetAgentMailboxForTesting } from '../mailbox/index.js';
import { closeSessionDb, initTestSessionDb } from '../mailbox/sqlite/connection.js';
import { SqliteAgentMailbox } from '../mailbox/sqlite/index.js';

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

// The OpenCode process registers the SQLite mailbox through the plugin file's
// barrel import; the tests register it over in-memory session databases.
let outbound: ReturnType<typeof initTestSessionDb>['outbound'];
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-hook-bridge-'));
  resetAgentMailboxForTesting();
  registerAgentMailbox(() => new SqliteAgentMailbox());
  outbound = initTestSessionDb().outbound;
});
afterEach(() => {
  closeSessionDb();
  resetAgentMailboxForTesting();
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

describe('failed tool parts', () => {
  it('reads a failed tool call from a part update and ignores everything else', () => {
    const part = (status: string) => ({
      type: 'message.part.updated',
      properties: {
        part: {
          type: 'tool',
          sessionID: 's',
          callID: 'c',
          tool: 'bash',
          state: { status, input: { command: 'x' }, error: 'boom' },
        },
      },
    });
    expect(failedToolPart(part('error'))).toEqual({
      sessionID: 's',
      callID: 'c',
      tool: 'bash',
      input: { command: 'x' },
      error: 'boom',
    });
    expect(failedToolPart(part('completed'))).toBeNull();
    expect(failedToolPart({ type: 'session.idle', properties: {} })).toBeNull();
  });
});

async function plugin(settings: HookSettings, client?: OpenCodeTodoClient) {
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ hooks: settings }));
  process.env.NANOCLAW_HOOK_SETTINGS = file;
  process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ mcp: { nanoclaw: {}, codex: {} } });
  return NanoclawHookBridge({ client });
}

/** A hook that appends its stdin, one JSON line, to `file`: the dashboard telemetry hook stands in like this. */
function recorder(file: string): { command: string } {
  return { command: `cat >> ${file}; echo >> ${file}` };
}

/** The hook inputs `recorder` saw, in order. */
function recorded(file: string): Record<string, unknown>[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('the OpenCode plugin', () => {
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

  it('runs PostToolUseFailure hooks once for a tool part that failed', async () => {
    const seen = path.join(dir, 'failure.jsonl');
    const hooks = await plugin({
      PostToolUseFailure: [{ matcher: 'Read', hooks: [{ command: `cat >> ${seen}; echo >> ${seen}` }] }],
    });
    const failed = {
      type: 'message.part.updated',
      properties: {
        part: {
          type: 'tool',
          sessionID: 's1',
          callID: 'call-1',
          tool: 'read',
          state: { status: 'error', input: { filePath: '/nope.txt' }, error: 'File not found' },
        },
      },
    };
    await hooks.event({ event: failed });
    await hooks.event({ event: failed }); // the part updates again: no second run
    await hooks.event({ event: { type: 'session.idle', properties: {} } });
    const lines = fs.readFileSync(seen, 'utf-8').trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      hook_event_name: 'PostToolUseFailure',
      session_id: 's1',
      tool_name: 'Read',
      tool_use_id: 'call-1',
      error: 'File not found',
    });
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

describe('tool events inside a subagent', () => {
  const event = (type: string, properties: Record<string, unknown>) => ({ event: { type, properties } });

  it('carry the main session as session_id, the subagent as agent_id, and the call id', async () => {
    const seen = path.join(dir, 'tools.jsonl');
    const hooks = await plugin({
      PreToolUse: [{ hooks: [recorder(seen)] }],
      PostToolUse: [{ hooks: [recorder(seen)] }],
      PostToolUseFailure: [{ hooks: [recorder(seen)] }],
    });
    await hooks.event(
      event('session.created', {
        sessionID: 'ses_child',
        info: { id: 'ses_child', parentID: 'ses_main', agent: 'explore' },
      }),
    );
    await hooks['tool.execute.before'](
      { tool: 'bash', sessionID: 'ses_child', callID: 'call_1' },
      { args: { command: 'ls' } },
    );
    await hooks['tool.execute.after'](
      { tool: 'bash', sessionID: 'ses_child', callID: 'call_1', args: { command: 'ls' } },
      { output: 'a\n' },
    );
    await hooks.event(
      event('message.part.updated', {
        part: {
          type: 'tool',
          sessionID: 'ses_child',
          callID: 'call_2',
          tool: 'read',
          state: { status: 'error', input: { filePath: '/x' }, error: 'gone' },
        },
      }),
    );
    const identity = recorded(seen).map((input) => [
      input.hook_event_name,
      input.session_id,
      input.agent_id,
      input.agent_type,
      input.tool_use_id,
    ]);
    expect(identity).toEqual([
      ['PreToolUse', 'ses_main', 'ses_child', 'explore', 'call_1'],
      ['PostToolUse', 'ses_main', 'ses_child', 'explore', 'call_1'],
      ['PostToolUseFailure', 'ses_main', 'ses_child', 'explore', 'call_2'],
    ]);
  });

  it('leave a main-session tool call without agent fields', async () => {
    const seen = path.join(dir, 'tools.jsonl');
    const hooks = await plugin({ PreToolUse: [{ hooks: [recorder(seen)] }] });
    await hooks['tool.execute.before']({ tool: 'bash', sessionID: 'ses_main', callID: 'call_1' }, { args: {} });
    const [input] = recorded(seen);
    expect(input).toMatchObject({ session_id: 'ses_main', tool_use_id: 'call_1' });
    expect(input).not.toHaveProperty('agent_id');
    expect(input).not.toHaveProperty('agent_type');
  });
});

describe('UserPromptSubmit context', () => {
  const prompt = () => ({
    message: { id: 'msg_user' },
    parts: [{ id: createOpenCodeId('prt'), type: 'text', text: 'fix the bug' }] as Record<string, unknown>[],
  });

  it("adds a hook's plain stdout and JSON additionalContext to the prompt as one synthetic part", async () => {
    const hooks = await plugin({
      UserPromptSubmit: [
        { hooks: [{ command: `echo 'Current branch: main'` }] },
        {
          hooks: [
            {
              command: `echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"<buddy-note>re-run the tests</buddy-note>"}}'`,
            },
          ],
        },
        { hooks: [{ command: 'true' }] },
      ],
    });
    const output = prompt();
    await hooks['chat.message']({ sessionID: 'ses_main', messageID: 'msg_user' }, output);
    expect(output.parts).toHaveLength(2);
    const [text, context] = output.parts;
    expect(context).toMatchObject({ sessionID: 'ses_main', messageID: 'msg_user', type: 'text', synthetic: true });
    // The hooks' contexts join in the order the hooks are registered.
    expect(context.text).toBe('Current branch: main\n\n<buddy-note>re-run the tests</buddy-note>');
    // OpenCode orders a message's parts by id: the context follows the prompt.
    expect(String(context.id).startsWith('prt_')).toBe(true);
    expect(String(context.id) > String(text.id)).toBe(true);
  });

  it('adds nothing when the hooks print nothing, and nothing to a subagent prompt', async () => {
    const hooks = await plugin({ UserPromptSubmit: [{ hooks: [{ command: `echo 'context'` }] }] });
    const quiet = await plugin({ UserPromptSubmit: [{ hooks: [{ command: 'true' }] }] });
    const output = prompt();
    await quiet['chat.message']({ sessionID: 'ses_main' }, output);
    expect(output.parts).toHaveLength(1);

    await hooks.event({
      event: { type: 'session.created', properties: { info: { id: 'ses_child', parentID: 'ses_main' } } },
    });
    const child = prompt();
    await hooks['chat.message']({ sessionID: 'ses_child' }, child);
    expect(child.parts).toHaveLength(1);
  });
});

// The real gate script, run the way the host registers it, on the commands an
// OpenCode coworker sent on prod: the bridge must refuse them before they post.
const BODY_GATE = path.join(import.meta.dir, '..', '..', '..', 'hooks', 'gate-github-comment-body.sh');
const hasBodyGateTools = ['python3', 'jq'].every((tool) => Bun.spawnSync(['sh', '-c', `command -v ${tool}`]).success);

describe.skipIf(!hasBodyGateTools)('the GitHub comment-body gate through the bridge', () => {
  async function gated() {
    const file = path.join(dir, 'settings.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: 'Bash|mcp__github__add_issue_comment',
              hooks: [{ type: 'command', command: `bash ${BODY_GATE}`, timeout: 5 }],
            },
          ],
        },
      }),
    );
    process.env.NANOCLAW_HOOK_SETTINGS = file;
    process.env.OPENCODE_CONFIG_CONTENT = JSON.stringify({ mcp: { nanoclaw: {}, github: {} } });
    return NanoclawHookBridge({});
  }

  it('refuses `gh api -f body=@<path>` from the bash tool and lets `-F body=@<path>` through', async () => {
    const body = path.join(dir, 'issue-comment-14489-final.md');
    fs.writeFileSync(body, '**Status:** fixed.\n');
    const hooks = await gated();
    const bash = (command: string) =>
      hooks['tool.execute.before'](
        { tool: 'bash', sessionID: 's1' },
        { args: { command, timeout: 120000, workdir: '/workspace/agent/wt-slang-14489' } },
      );
    await expect(
      bash(`gh api -X PATCH repos/shader-slang/slang/issues/comments/6912309417 -f body=@${body} --jq '.html_url'`),
    ).rejects.toThrow('GITHUB BODY IS A FILE NAME');
    await bash(`gh api -X PATCH repos/shader-slang/slang/issues/comments/6912309417 -F body=@${body} --jq '.body'`);
  });

  it('refuses a frontmatter body through the GitHub MCP tool OpenCode names github_add_issue_comment', async () => {
    const hooks = await gated();
    const comment = (body: string) =>
      hooks['tool.execute.before'](
        { tool: 'github_add_issue_comment', sessionID: 's1' },
        { args: { owner: 'o', repo: 'r', issue_number: 1, body } },
      );
    await expect(comment('---\ntype: comment\ntitle: x\n---\n\nbody\n')).rejects.toThrow(
      'GITHUB BODY STARTS WITH YAML FRONTMATTER',
    );
    await comment('Thanks @jkwak-work.\n\n---\n\nDetails.\n');
  });
});

describe('lifecycle events', () => {
  const event = (type: string, properties: Record<string, unknown>) => ({ event: { type, properties } });

  it('runs the SubagentStart and SubagentStop hooks whose matcher selects the agent type', async () => {
    const seen = path.join(dir, 'subagent.jsonl');
    const other = path.join(dir, 'other.jsonl');
    const hooks = await plugin({
      SubagentStart: [{ hooks: [recorder(seen)] }, { matcher: 'general', hooks: [recorder(other)] }],
      SubagentStop: [{ matcher: 'explore', hooks: [recorder(seen)] }],
    });
    await hooks.event(
      event('session.created', {
        sessionID: 'ses_child',
        info: { id: 'ses_child', parentID: 'ses_main', agent: 'explore' },
      }),
    );
    await hooks.event(event('session.status', { sessionID: 'ses_child', status: { type: 'busy' } }));
    await hooks.event(event('message.updated', { info: { id: 'msg_1', sessionID: 'ses_child', role: 'assistant' } }));
    await hooks.event(
      event('message.part.updated', {
        part: { type: 'text', sessionID: 'ses_child', messageID: 'msg_1', text: 'done' },
      }),
    );
    await hooks.event(event('session.idle', { sessionID: 'ses_child' }));
    expect(recorded(seen)).toEqual([
      {
        hook_event_name: 'SubagentStart',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        agent_id: 'ses_child',
        agent_type: 'explore',
      },
      {
        hook_event_name: 'SubagentStop',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        agent_id: 'ses_child',
        agent_type: 'explore',
        stop_hook_active: false,
        last_assistant_message: 'done',
      },
    ]);
    expect(recorded(other)).toEqual([]);
  });

  it("runs no UserPromptSubmit hook for a subagent's prompt", async () => {
    const seen = path.join(dir, 'prompt.jsonl');
    const hooks = await plugin({ UserPromptSubmit: [{ hooks: [recorder(seen)] }] });
    await hooks.event(
      event('session.created', { sessionID: 'ses_child', info: { id: 'ses_child', parentID: 'ses_main' } }),
    );
    const parts = (t: string) => ({ parts: [{ type: 'text', text: t }] });
    await hooks['chat.message']({ sessionID: 'ses_child' }, parts('find the call sites'));
    await hooks['chat.message']({ sessionID: 'ses_main' }, parts('fix the bug'));
    expect(recorded(seen).map((input) => [input.session_id, input.prompt])).toEqual([['ses_main', 'fix the bug']]);
  });

  it('adds the PreCompact stdout to the compaction prompt, then reports the compaction', async () => {
    const seen = path.join(dir, 'compact.jsonl');
    const hooks = await plugin({
      PreCompact: [{ hooks: [{ command: `echo 'Keep the <message> blocks.'` }, recorder(seen)] }],
      SessionStart: [{ matcher: 'compact', hooks: [recorder(seen)] }],
      PostCompact: [{ matcher: 'auto', hooks: [recorder(seen)] }],
    });
    await hooks.event(
      event('message.part.updated', {
        part: { type: 'compaction', sessionID: 'ses_main', messageID: 'msg_user', auto: true },
      }),
    );
    const output = { context: [] as string[] };
    await hooks['experimental.session.compacting']({ sessionID: 'ses_main' }, output);
    expect(output.context).toEqual(['Keep the <message> blocks.']);

    await hooks.event(
      event('message.updated', { info: { id: 'msg_sum', sessionID: 'ses_main', role: 'assistant', summary: true } }),
    );
    await hooks.event(
      event('message.part.updated', {
        part: { type: 'text', sessionID: 'ses_main', messageID: 'msg_sum', text: 'The summary.' },
      }),
    );
    await hooks.event(event('session.compacted', { sessionID: 'ses_main' }));
    expect(recorded(seen)).toEqual([
      {
        hook_event_name: 'PreCompact',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        trigger: 'auto',
        custom_instructions: null,
      },
      { hook_event_name: 'SessionStart', cwd: '/workspace/agent', session_id: 'ses_main', source: 'compact' },
      {
        hook_event_name: 'PostCompact',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        trigger: 'auto',
        compact_summary: 'The summary.',
      },
    ]);
  });

  function todoClient(todos: unknown): OpenCodeTodoClient & { reads: string[] } {
    const reads: string[] = [];
    return {
      reads,
      session: {
        async todo({ path: { id } }) {
          reads.push(id);
          return { data: todos };
        },
      },
    };
  }

  it('runs TaskCreated and TaskCompleted for a todowrite, against the stored list', async () => {
    const seen = path.join(dir, 'tasks.jsonl');
    const client = todoClient([{ content: 'Read the issue', status: 'in_progress', priority: 'high' }]);
    const hooks = await plugin(
      { TaskCreated: [{ matcher: 'ignored', hooks: [recorder(seen)] }], TaskCompleted: [{ hooks: [recorder(seen)] }] },
      client,
    );
    await hooks['tool.execute.before'](
      { tool: 'todowrite', sessionID: 'ses_main' },
      {
        args: {
          todos: [
            { content: 'Read the issue', status: 'completed', priority: 'high' },
            { content: 'Write the test', status: 'pending', priority: 'high' },
          ],
        },
      },
    );
    expect(client.reads).toEqual(['ses_main']);
    expect(recorded(seen)).toEqual([
      {
        hook_event_name: 'TaskCompleted',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        task_id: '1',
        task_subject: 'Read the issue',
      },
      {
        hook_event_name: 'TaskCreated',
        cwd: '/workspace/agent',
        session_id: 'ses_main',
        task_id: '2',
        task_subject: 'Write the test',
      },
    ]);
  });

  it('refuses a todowrite whose task a TaskCreated hook blocks', async () => {
    const hooks = await plugin(
      { TaskCreated: [{ hooks: [{ command: `echo 'name the ticket first' >&2; exit 2` }] }] },
      todoClient([]),
    );
    await expect(
      hooks['tool.execute.before'](
        { tool: 'todowrite', sessionID: 'ses_main' },
        { args: { todos: [{ content: 'Fix it', status: 'pending', priority: 'low' }] } },
      ),
    ).rejects.toThrow('name the ticket first');
  });

  it('runs no task hooks when the server cannot say what the list was', async () => {
    const seen = path.join(dir, 'tasks.jsonl');
    const failing: OpenCodeTodoClient = {
      session: {
        async todo() {
          throw new Error('connection refused');
        },
      },
    };
    const hooks = await plugin({ TaskCreated: [{ hooks: [recorder(seen)] }] }, failing);
    await hooks['tool.execute.before'](
      { tool: 'todowrite', sessionID: 'ses_main' },
      { args: { todos: [{ content: 'Fix it', status: 'pending', priority: 'low' }] } },
    );
    expect(recorded(seen)).toEqual([]);
  });
});

describe('session hooks of a query', () => {
  it('runs SessionStart for the matching source and SessionEnd with reason other', async () => {
    const seen = path.join(dir, 'session.jsonl');
    const file = path.join(dir, 'settings.json');
    const settings: HookSettings = {
      SessionStart: [
        { matcher: 'startup|resume', hooks: [recorder(seen)] },
        { matcher: 'compact', hooks: [] },
      ],
      SessionEnd: [{ hooks: [recorder(seen)] }],
    };
    fs.writeFileSync(file, JSON.stringify({ hooks: settings }));
    const hooks = settingsSessionHooks({ NANOCLAW_HOOK_SETTINGS: file });
    await hooks.start('ses_1', 'resume', 'nvidia/zai-org/glm-5.3');
    await hooks.end('ses_1');
    expect(recorded(seen)).toEqual([
      {
        hook_event_name: 'SessionStart',
        cwd: '/workspace/agent',
        session_id: 'ses_1',
        source: 'resume',
        model: 'nvidia/zai-org/glm-5.3',
      },
      { hook_event_name: 'SessionEnd', cwd: '/workspace/agent', session_id: 'ses_1', reason: 'other' },
    ]);
  });
});

describe('the tool in flight', () => {
  const inFlight = () =>
    outbound.prepare('SELECT current_tool, tool_declared_timeout_ms, tool_started_at FROM container_state').get() as {
      current_tool: string | null;
      tool_declared_timeout_ms: number | null;
      tool_started_at: string | null;
    } | null;

  it('records a tool that passed its gates and clears it when the tool finishes', async () => {
    const hooks = await plugin({});
    await hooks['tool.execute.before'](
      { tool: 'bash', sessionID: 's1' },
      { args: { command: 'make', timeout: 900000 } },
    );
    expect(inFlight()).toMatchObject({ current_tool: 'Bash', tool_declared_timeout_ms: 900000 });
    expect(inFlight()?.tool_started_at).toBeString();

    await hooks['tool.execute.after']({ tool: 'bash', sessionID: 's1', args: { command: 'make' } }, { output: 'ok' });
    expect(inFlight()).toEqual({ current_tool: null, tool_declared_timeout_ms: null, tool_started_at: null });
  });

  it('records no declared timeout for a tool other than Bash', async () => {
    const hooks = await plugin({});
    await hooks['tool.execute.before']({ tool: 'nanoclaw_send_message' }, { args: { text: 'hi', timeout: 5 } });
    expect(inFlight()).toMatchObject({ current_tool: 'mcp__nanoclaw__send_message', tool_declared_timeout_ms: null });
  });

  it('clears the record when the tool fails', async () => {
    const hooks = await plugin({});
    await hooks['tool.execute.before']({ tool: 'read', sessionID: 's1' }, { args: { filePath: '/nope' } });
    expect(inFlight()?.current_tool).toBe('Read');
    await hooks.event({
      event: {
        type: 'message.part.updated',
        properties: {
          part: {
            type: 'tool',
            sessionID: 's1',
            callID: 'c1',
            tool: 'read',
            state: { status: 'error', error: 'gone' },
          },
        },
      },
    });
    expect(inFlight()?.current_tool).toBeNull();
  });

  it('records nothing for a call a gate refuses', async () => {
    const hooks = await plugin({
      PreToolUse: [{ matcher: 'Write', hooks: [{ command: `echo 'PLAN REQUIRED' >&2; exit 2` }] }],
    });
    await expect(
      hooks['tool.execute.before']({ tool: 'write', sessionID: 's1' }, { args: { filePath: '/x', content: '' } }),
    ).rejects.toThrow('PLAN REQUIRED');
    expect(inFlight()).toBeNull(); // no row: nothing was ever in flight
  });
});

describe('installation', () => {
  it('writes a plugin file that registers the mailbox and re-exports only the bridge', () => {
    const file = installOpenCodeHookBridge(
      dir,
      '/app/src/providers/opencode-hook-bridge.ts',
      '/app/src/modules/index.ts',
    );
    expect(file).toBe(path.join(dir, 'opencode', 'plugin', 'nanoclaw-hook-bridge.js'));
    expect(fs.readFileSync(file, 'utf-8')).toBe(
      'import "/app/src/modules/index.ts";\n' +
        'export { NanoclawHookBridge } from "/app/src/providers/opencode-hook-bridge.ts";\n',
    );
  });

  it('points the plugin file at the runner capability barrel by default', () => {
    const file = installOpenCodeHookBridge(dir);
    const barrel = /^import "(.+)";$/m.exec(fs.readFileSync(file, 'utf-8'))?.[1];
    expect(barrel).toBe(path.join(import.meta.dir, '..', 'modules', 'index.ts'));
    expect(fs.existsSync(barrel!)).toBe(true);
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
