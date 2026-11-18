/**
 * Claude Code lifecycle hook calls for an OpenCode server (fork-owned).
 *
 * OpenCode reports the life of its sessions on its event bus; Claude Code
 * reports the same moments as hook events. `OpenCodeLifecycle` reads the bus
 * events the hook bridge receives and returns the hook calls Claude Code makes
 * at the same moment, with the payload Claude Code sends, so the bridge can run
 * the group's settings.json hooks for them (OpenCode 1.18):
 *
 *   OpenCode                                          Claude Code hook event
 *   a child session (one with a parentID) turns busy  SubagentStart
 *   that child session turns idle                     SubagentStop
 *   experimental.session.compacting                   PreCompact
 *   session.compacted                                 SessionStart (source compact), PostCompact
 *   a todowrite that adds or completes a todo         TaskCreated, TaskCompleted
 *
 * Claude Code runs a subagent inside the main session and adds `agent_id` and
 * `agent_type` to the hooks that fire in it; OpenCode runs a subagent in a
 * child session of its own. Consider a reviewer that calls OpenCode's task
 * tool with `subagent_type: "explore"`. OpenCode creates a child session with
 * `parentID` set to the reviewer's session and `agent: "explore"`, sets it
 * busy, runs the prompt and sets it idle. The tracker records the child when
 * `session.created` arrives, returns SubagentStart when the child turns busy
 * and SubagentStop, with the child's last reply, when it turns idle. Both carry
 * the reviewer's session as `session_id` and the child session as `agent_id`,
 * as Claude Code's do, so the dashboard shows them in the reviewer's session.
 *
 * The tracker changes its state synchronously in `observe`. OpenCode calls a
 * plugin's event hook while it publishes the event, so the tracker knows a
 * child session before the child's first prompt reaches `chat.message`.
 */
import type { HookEvent } from '../settings-hooks.js';

/** One hook event to run: the event, the value its matcher selects on, and the hook input. */
export interface LifecycleHookCall {
  event: HookEvent;
  matchTarget: string;
  payload: Record<string, unknown>;
}

/** An OpenCode bus event, as a plugin's `event` hook receives it. */
export interface OpenCodeEvent {
  type?: string;
  properties?: Record<string, unknown>;
}

/** The fields of an OpenCode todo that the task hooks read. */
export interface OpenCodeTodo {
  content: string;
  status: string;
}

type CompactionTrigger = 'auto' | 'manual';

interface ChildSession {
  parentID: string;
  agentType: string;
  running: boolean;
  lastReply: string;
}

interface Compaction {
  trigger: CompactionTrigger;
  /** The assistant message that holds the summary (`summary: true`). */
  messageID?: string;
  summary: string;
}

/** Return `value` when it is a string, else ''. */
function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Return the todos in `value` (a todowrite `todos` argument or a stored todo
 * list) that have a text and a status; anything else is not a todo.
 */
export function todoList(value: unknown): OpenCodeTodo[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const todo = item as { content?: unknown; status?: unknown } | null;
    return todo && typeof todo.content === 'string' && typeof todo.status === 'string'
      ? [{ content: todo.content, status: todo.status }]
      : [];
  });
}

export class OpenCodeLifecycle {
  private readonly children = new Map<string, ChildSession>();
  /** Assistant messages whose text the tracker keeps, by message id: child replies and compaction summaries. */
  private readonly messages = new Map<string, string>();
  private readonly compactions = new Map<string, Compaction>();

  /** True when `sessionID` is a child session, the session of a subagent. */
  isSubagent(sessionID: string): boolean {
    return this.children.has(sessionID);
  }

  /**
   * Return the hook fields that say which session an event belongs to. A main
   * session is its own `session_id`. A child session reports the main session
   * at the top of its parent chain as `session_id`, and itself as `agent_id`.
   */
  sessionFields(sessionID: string): Record<string, unknown> {
    const child = this.children.get(sessionID);
    if (!child) return { session_id: sessionID };
    let main = child.parentID;
    for (let parent = this.children.get(main); parent; parent = this.children.get(main)) main = parent.parentID;
    return { session_id: main, agent_id: sessionID, agent_type: child.agentType };
  }

  /** Record what `event` says about the sessions, and return the hook calls it makes. */
  observe(event: OpenCodeEvent): LifecycleHookCall[] {
    const props = event.properties ?? {};
    switch (event.type) {
      case 'session.created':
      case 'session.updated':
        this.recordSession(props.info);
        return [];
      case 'session.status':
        return this.childBusy(str(props.sessionID), (props.status as { type?: unknown } | undefined)?.type);
      case 'session.idle':
        return this.childIdle(str(props.sessionID));
      case 'message.updated':
        this.recordMessage(props.info);
        return [];
      case 'message.part.updated':
        this.recordPart(props.part);
        return [];
      case 'session.compacted':
        return this.compacted(str(props.sessionID));
      default:
        return [];
    }
  }

  /** Return the PreCompact call for a compaction of `sessionID` that is about to start. */
  preCompact(sessionID: string): LifecycleHookCall {
    const trigger = this.compactions.get(sessionID)?.trigger ?? 'auto';
    return {
      event: 'PreCompact',
      matchTarget: trigger,
      payload: { ...this.sessionFields(sessionID), trigger, custom_instructions: null },
    };
  }

  /**
   * Return the TaskCreated and TaskCompleted calls of a todowrite in
   * `sessionID` that replaces the list `before` with `after`. A todo is a
   * Claude Code task: its text is the `task_subject`, and a todo whose text is
   * not in `before` is a new task. OpenCode todos have no id, so `task_id` is
   * the todo's 1-based position in `after`, as Claude Code numbers its tasks.
   * A todo that becomes `completed` completes its task.
   */
  taskCalls(sessionID: string, before: readonly OpenCodeTodo[], after: readonly OpenCodeTodo[]): LifecycleHookCall[] {
    const previous = new Map(before.map((todo) => [todo.content, todo.status]));
    const fields = this.sessionFields(sessionID);
    return after.flatMap((todo, index) => {
      const payload = { ...fields, task_id: String(index + 1), task_subject: todo.content };
      const calls: LifecycleHookCall[] = [];
      if (!previous.has(todo.content)) calls.push({ event: 'TaskCreated', matchTarget: '', payload });
      if (todo.status === 'completed' && previous.get(todo.content) !== 'completed') {
        calls.push({ event: 'TaskCompleted', matchTarget: '', payload });
      }
      return calls;
    });
  }

  private recordSession(info: unknown): void {
    const session = info as { id?: unknown; parentID?: unknown; agent?: unknown } | undefined;
    const id = str(session?.id);
    const parentID = str(session?.parentID);
    if (!id || !parentID || this.children.has(id)) return;
    this.children.set(id, { parentID, agentType: str(session?.agent), running: false, lastReply: '' });
  }

  // A run sets the session busy at every model step; only the first busy after
  // idle starts the subagent (a task_id resume starts it again).
  private childBusy(sessionID: string, status: unknown): LifecycleHookCall[] {
    const child = this.children.get(sessionID);
    if (!child || status !== 'busy' || child.running) return [];
    child.running = true;
    child.lastReply = '';
    return [{ event: 'SubagentStart', matchTarget: child.agentType, payload: this.sessionFields(sessionID) }];
  }

  // A failed run can report idle twice (the error, then the end of the run).
  private childIdle(sessionID: string): LifecycleHookCall[] {
    const child = this.children.get(sessionID);
    if (!child?.running) return [];
    child.running = false;
    for (const [messageID, owner] of this.messages) if (owner === sessionID) this.messages.delete(messageID);
    return [
      {
        event: 'SubagentStop',
        matchTarget: child.agentType,
        payload: { ...this.sessionFields(sessionID), stop_hook_active: false, last_assistant_message: child.lastReply },
      },
    ];
  }

  private recordMessage(info: unknown): void {
    const message = info as { id?: unknown; sessionID?: unknown; role?: unknown; summary?: unknown } | undefined;
    const id = str(message?.id);
    const sessionID = str(message?.sessionID);
    if (message?.role !== 'assistant' || !id || !sessionID) return;
    if (message.summary === true) {
      const compaction = this.compactions.get(sessionID) ?? { trigger: 'auto', summary: '' };
      this.compactions.set(sessionID, { ...compaction, messageID: id });
      this.messages.set(id, sessionID);
    } else if (this.children.has(sessionID)) {
      this.messages.set(id, sessionID);
    }
  }

  private recordPart(value: unknown): void {
    const part = value as
      { type?: unknown; sessionID?: unknown; messageID?: unknown; text?: unknown; auto?: unknown } | undefined;
    // OpenCode starts every compaction with a `compaction` part on a user message;
    // its `auto` flag is Claude Code's trigger.
    if (part?.type === 'compaction' && str(part.sessionID)) {
      this.compactions.set(str(part.sessionID), { trigger: part.auto === false ? 'manual' : 'auto', summary: '' });
      return;
    }
    const messageID = str(part?.messageID);
    const sessionID = this.messages.get(messageID);
    if (part?.type !== 'text' || typeof part.text !== 'string' || sessionID === undefined) return;
    const compaction = this.compactions.get(sessionID);
    const child = this.children.get(sessionID);
    if (compaction && compaction.messageID === messageID) compaction.summary = part.text;
    else if (child) child.lastReply = part.text;
  }

  // Claude Code starts the session again (source compact) once compaction
  // succeeds, then reports PostCompact. A child session is not a Claude Code
  // session, so its compaction reports PostCompact only.
  private compacted(sessionID: string): LifecycleHookCall[] {
    const compaction = this.compactions.get(sessionID) ?? { trigger: 'auto', summary: '' };
    this.compactions.delete(sessionID);
    if (compaction.messageID) this.messages.delete(compaction.messageID);
    const fields = this.sessionFields(sessionID);
    const calls: LifecycleHookCall[] = [];
    if (!this.children.has(sessionID)) {
      calls.push({ event: 'SessionStart', matchTarget: 'compact', payload: { ...fields, source: 'compact' } });
    }
    calls.push({
      event: 'PostCompact',
      matchTarget: compaction.trigger,
      payload: { ...fields, trigger: compaction.trigger, compact_summary: compaction.summary },
    });
    return calls;
  }
}
