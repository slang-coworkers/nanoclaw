import { describe, expect, it } from 'bun:test';

import { OpenCodeLifecycle, todoList, type OpenCodeEvent } from './opencode-lifecycle.js';

// Fork-owned. These tests pin how OpenCode 1.18 bus events become Claude Code
// lifecycle hook calls. The event shapes are the ones OpenCode publishes
// (session/session.ts, session/status.ts, session/compaction.ts, tool/task.ts).

const created = (id: string, parentID?: string, agent?: string): OpenCodeEvent => ({
  type: 'session.created',
  properties: { sessionID: id, info: { id, parentID, agent } },
});
const status = (sessionID: string, type: string): OpenCodeEvent => ({
  type: 'session.status',
  properties: { sessionID, status: { type } },
});
const idle = (sessionID: string): OpenCodeEvent => ({ type: 'session.idle', properties: { sessionID } });
const assistant = (sessionID: string, id: string, summary?: boolean): OpenCodeEvent => ({
  type: 'message.updated',
  properties: { sessionID, info: { id, sessionID, role: 'assistant', ...(summary ? { summary } : {}) } },
});
const text = (sessionID: string, messageID: string, body: string): OpenCodeEvent => ({
  type: 'message.part.updated',
  properties: { sessionID, part: { type: 'text', sessionID, messageID, text: body } },
});
const compactionPart = (sessionID: string, auto: boolean): OpenCodeEvent => ({
  type: 'message.part.updated',
  properties: { sessionID, part: { type: 'compaction', sessionID, messageID: 'msg_user', auto } },
});

describe('subagents', () => {
  it('reports a task child session as SubagentStart and SubagentStop in the main session', () => {
    const life = new OpenCodeLifecycle();
    expect(life.observe(created('ses_main'))).toEqual([]);
    expect(life.observe(created('ses_child', 'ses_main', 'explore'))).toEqual([]);
    expect(life.isSubagent('ses_child')).toBe(true);
    expect(life.isSubagent('ses_main')).toBe(false);

    expect(life.observe(status('ses_child', 'busy'))).toEqual([
      {
        event: 'SubagentStart',
        matchTarget: 'explore',
        payload: { session_id: 'ses_main', agent_id: 'ses_child', agent_type: 'explore' },
      },
    ]);
    // OpenCode sets the session busy again at every model step.
    expect(life.observe(status('ses_child', 'busy'))).toEqual([]);
    expect(life.observe(status('ses_child', 'retry'))).toEqual([]);

    life.observe(assistant('ses_child', 'msg_1'));
    life.observe(text('ses_child', 'msg_1', 'first step'));
    life.observe(assistant('ses_child', 'msg_2'));
    life.observe(text('ses_child', 'msg_2', ''));
    life.observe(text('ses_child', 'msg_2', 'Found 3 call sites.'));

    expect(life.observe(idle('ses_child'))).toEqual([
      {
        event: 'SubagentStop',
        matchTarget: 'explore',
        payload: {
          session_id: 'ses_main',
          agent_id: 'ses_child',
          agent_type: 'explore',
          stop_hook_active: false,
          last_assistant_message: 'Found 3 call sites.',
        },
      },
    ]);
    // A failed run reports idle twice; the subagent stopped once.
    expect(life.observe(idle('ses_child'))).toEqual([]);
  });

  it('starts the subagent again when a task resumes its child session', () => {
    const life = new OpenCodeLifecycle();
    life.observe(created('ses_child', 'ses_main', 'general'));
    life.observe(status('ses_child', 'busy'));
    life.observe(idle('ses_child'));
    const again = life.observe(status('ses_child', 'busy'));
    expect(again.map((c) => c.event)).toEqual(['SubagentStart']);
    expect(life.observe(idle('ses_child'))[0].payload.last_assistant_message).toBe('');
  });

  it('learns a child from session.updated and reports a nested child in the main session', () => {
    const life = new OpenCodeLifecycle();
    life.observe({ type: 'session.updated', properties: { info: { id: 'ses_a', parentID: 'ses_main', agent: 'a' } } });
    life.observe(created('ses_b', 'ses_a', 'b'));
    expect(life.sessionFields('ses_b')).toEqual({ session_id: 'ses_main', agent_id: 'ses_b', agent_type: 'b' });
  });

  it('leaves the main session to the runner, which owns its Stop', () => {
    const life = new OpenCodeLifecycle();
    life.observe(created('ses_main'));
    expect(life.observe(status('ses_main', 'busy'))).toEqual([]);
    expect(life.observe(idle('ses_main'))).toEqual([]);
    expect(life.observe({ type: 'session.deleted', properties: { sessionID: 'ses_main' } })).toEqual([]);
  });
});

describe('compaction', () => {
  it('reports PreCompact, then SessionStart (compact) and PostCompact with the summary', () => {
    const life = new OpenCodeLifecycle();
    life.observe(compactionPart('ses_main', true));
    expect(life.preCompact('ses_main')).toEqual({
      event: 'PreCompact',
      matchTarget: 'auto',
      payload: { session_id: 'ses_main', trigger: 'auto', custom_instructions: null },
    });
    life.observe(assistant('ses_main', 'msg_summary', true));
    life.observe(text('ses_main', 'msg_summary', '## Goal\nShip the fix.'));
    expect(life.observe({ type: 'session.compacted', properties: { sessionID: 'ses_main' } })).toEqual([
      { event: 'SessionStart', matchTarget: 'compact', payload: { session_id: 'ses_main', source: 'compact' } },
      {
        event: 'PostCompact',
        matchTarget: 'auto',
        payload: { session_id: 'ses_main', trigger: 'auto', compact_summary: '## Goal\nShip the fix.' },
      },
    ]);
  });

  it('reads a manual compaction from the compaction part', () => {
    const life = new OpenCodeLifecycle();
    life.observe(compactionPart('ses_main', false));
    expect(life.preCompact('ses_main').matchTarget).toBe('manual');
  });

  it('reports a child session compaction as PostCompact only, in the main session', () => {
    const life = new OpenCodeLifecycle();
    life.observe(created('ses_child', 'ses_main', 'general'));
    life.observe(compactionPart('ses_child', true));
    const calls = life.observe({ type: 'session.compacted', properties: { sessionID: 'ses_child' } });
    expect(calls.map((c) => c.event)).toEqual(['PostCompact']);
    expect(calls[0].payload).toMatchObject({ session_id: 'ses_main', agent_id: 'ses_child' });
  });
});

describe('todos as tasks', () => {
  it('creates a task for a new todo and completes it when its status becomes completed', () => {
    const life = new OpenCodeLifecycle();
    const before = [{ content: 'Read the issue', status: 'in_progress' }];
    const after = [
      { content: 'Read the issue', status: 'completed' },
      { content: 'Write the test', status: 'pending' },
    ];
    expect(life.taskCalls('ses_main', before, after)).toEqual([
      {
        event: 'TaskCompleted',
        matchTarget: '',
        payload: { session_id: 'ses_main', task_id: '1', task_subject: 'Read the issue' },
      },
      {
        event: 'TaskCreated',
        matchTarget: '',
        payload: { session_id: 'ses_main', task_id: '2', task_subject: 'Write the test' },
      },
    ]);
    expect(life.taskCalls('ses_main', after, after)).toEqual([]);
  });

  it('creates and completes a todo that is written already completed', () => {
    const life = new OpenCodeLifecycle();
    const calls = life.taskCalls('ses_main', [], [{ content: 'Done already', status: 'completed' }]);
    expect(calls.map((c) => c.event)).toEqual(['TaskCreated', 'TaskCompleted']);
  });

  it('keeps only the items that are todos', () => {
    expect(todoList([{ content: 'a', status: 'pending', priority: 'high' }, { content: 1 }, null, 'x'])).toEqual([
      { content: 'a', status: 'pending' },
    ]);
    expect(todoList(undefined)).toEqual([]);
  });
});
