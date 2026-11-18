import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { OpenCodeMessage, OpenCodeSessionClient } from './opencode-turn.js';
import type { OpenCodeMemorySessionHook } from './opencode-memory.js';
import { MAX_OUTPUT_LIMIT_CONTINUES, OUTPUT_LIMIT_CONTINUE_PROMPT } from './opencode-output-limit.js';

import {
  destroySharedRuntime,
  OpenCodeProvider,
  setSharedRuntimeDepsForTesting,
  type OpenCodeSharedRuntimeDeps,
  type QuestionClient,
} from './opencode.js';
import { initTestSessionDb, closeSessionDb, getInboundDb } from '../mailbox/sqlite/connection.js';
import { getUndeliveredMessages } from '../db/messages-out.js';
import { processQuery } from '../poll-loop.js';
import { registerAgentMailbox, resetAgentMailboxForTesting } from '../mailbox/index.js';
import { SqliteAgentMailbox } from '../mailbox/sqlite/index.js';
import { createProvider } from './factory.js';
import { registerProviderMemorySessionHook } from '../provider-contracts/realize.js';
import '../provider-contracts/index.js';
import type { ProviderEvent, ProviderExchange } from './types.js';

/**
 * The shared `opencode serve` lifecycle, driven through the
 * `setSharedRuntimeDepsForTesting` seam so no server process is ever spawned.
 *
 * Covers three review findings against the provider:
 *  - a failed or half-failed runtime init must never be cached, and a server
 *    that dies must drop out of the cache, so the next turn respawns it
 *    instead of every later message failing instantly with the same error;
 *  - `isSessionInvalid` must only fire on OpenCode's own session-not-found
 *    signal, never on backend/model errors, so a mistyped model id or a proxy
 *    hiccup does not wipe the stored conversation;
 *  - `abort()` stops one session and keeps the server; the in-turn watchdog
 *    treats the server's 10-second `server.heartbeat` as liveness.
 */

type Ev = { type: string; properties: Record<string, unknown> };

const MEMORY_HOOK: OpenCodeMemorySessionHook = {
  command: 'true',
  legacyCommands: [],
  sources: ['startup', 'compact'],
};

const CWD = '/tmp/opencode-shared-runtime-test';

function assistantReply(sessionID: string, text: string): Ev[] {
  return [
    { type: 'message.updated', properties: { info: { id: `msg_${text}`, role: 'assistant', sessionID } } },
    {
      type: 'message.part.updated',
      properties: { part: { type: 'text', messageID: `msg_${text}`, sessionID, text } },
    },
    { type: 'session.idle', properties: { sessionID } },
  ];
}

type FakeProc = ChildProcess & { kill: ReturnType<typeof mock>; emitExit(code: number): void };

/**
 * One fake server: a process handle whose `kill` ends the event stream (the
 * way SIGKILL drops a real SSE connection), plus a client whose `prompt`
 * hands the session id to the test so it decides what the server "emits".
 */
function fakeServer(onPrompt: (sessionId: string, promptIndex: number) => void) {
  const END = Symbol('end');
  const queue: Array<Ev | typeof END> = [{ type: 'server.connected', properties: {} }];
  const history = new Map<string, OpenCodeMessage[]>();
  let current:
    | { sessionId: string; userId: string; resolve(value: { data?: OpenCodeMessage; error?: unknown }): void }
    | undefined;
  let promptHandler = onPrompt;
  const finish = (error?: unknown) => {
    if (!current) return;
    let message = history
      .get(current.sessionId)!
      .findLast((m) => m.info.role === 'assistant' && m.info.parentID === current!.userId);
    if (error) {
      message = {
        info: {
          id: 'msg_error_' + current.userId,
          role: 'assistant',
          parentID: current.userId,
          time: { created: Date.now(), completed: Date.now() },
          error,
        },
        parts: [],
      };
      history.get(current.sessionId)!.push(message);
    }
    if (message) {
      current.resolve({ data: message });
      current = undefined;
    }
  };
  const waiters: Array<() => void> = [];
  const push = (events: Ev[]): void => {
    for (const event of events) {
      if (!current) continue;
      const rows = history.get(current.sessionId)!;
      const info = event.properties.info as (OpenCodeMessage['info'] & { sessionID?: string }) | undefined;
      if (event.type === 'message.updated' && info?.sessionID === current.sessionId && info.role === 'assistant') {
        rows.push({
          info: { ...info, parentID: current.userId, time: { created: Date.now(), completed: Date.now() } },
          parts: [],
        });
      }
      const part = event.properties.part as { type: string; text?: string; messageID: string } | undefined;
      if (event.type === 'message.part.updated' && part)
        rows.find((m) => m.info.id === part.messageID)?.parts.push({ ...part, id: 'prt_' + part.messageID });
    }
    queue.push(...events);
    while (waiters.length > 0 && queue.length > 0) waiters.shift()!();
  };
  const endStream = (): void => {
    queue.push(END);
    while (waiters.length > 0) waiters.shift()!();
  };
  async function* stream(): AsyncGenerator<Ev, void, void> {
    while (true) {
      if (queue.length === 0) await new Promise<void>((resolve) => waiters.push(resolve));
      const ev = queue.shift()!;
      if (ev === END) return;
      yield ev;
    }
  }

  const emitter = new EventEmitter();
  const proc = Object.assign(emitter, {
    pid: undefined,
    exitCode: null as number | null,
    signalCode: null,
    // Teardown marks the subscription released before killing its server.
    // The real SDK's onSseError then stops retries; model the closed stream.
    kill: mock(() => {
      endStream();
      return true;
    }),
    emitExit(code: number) {
      proc.exitCode = code;
      endStream();
      emitter.emit('exit', code, null);
    },
  }) as unknown as FakeProc;

  let sessionCount = 0;
  let promptCount = 0;
  // A live server answers an abort with that session's own error event.
  const abort = mock(async (params: { path: { id: string } }) => {
    push([
      {
        type: 'session.error',
        properties: {
          sessionID: params.path.id,
          error: { name: 'MessageAbortedError', data: { message: 'aborted' } },
        },
      },
    ]);
    finish({ name: 'MessageAbortedError', data: { message: 'aborted' } });
    return {};
  });
  const subscribe = mock(async (opts?: { signal?: AbortSignal }) => {
    opts?.signal?.addEventListener('abort', () => endStream(), { once: true });
    return { stream: stream() };
  });
  const client = {
    event: { subscribe },
    session: {
      async create() {
        sessionCount += 1;
        return { data: { id: `ses_${sessionCount}` } };
      },
      prompt: (async (params) => {
        promptCount += 1;
        const rows = history.get(params.path.id) ?? [];
        history.set(params.path.id, rows);
        rows.push({ info: { id: params.body.messageID, role: 'user', time: { created: Date.now() } }, parts: [] });
        return await new Promise((resolve) => {
          current = { sessionId: params.path.id, userId: params.body.messageID, resolve };
          promptHandler(params.path.id, promptCount);
        });
      }) as OpenCodeSessionClient['prompt'],
      messages: (async (params) => ({
        data: (history.get(params.path.id) ?? []).slice(-params.query.limit),
      })) as OpenCodeSessionClient['messages'],
      abort,
    },
  };
  const questionClient: QuestionClient = {
    question: {
      async reply() {
        return { data: true };
      },
      async list() {
        return { data: [] };
      },
    },
  };

  return {
    proc,
    client,
    questionClient,
    push,
    // Events and HTTP completion are independent. A stale idle/error event
    // cannot resolve the native prompt in this fixture any more than in production.
    finish,
    reply(sessionId: string, text: string) {
      push(assistantReply(sessionId, text));
      finish();
    },
    fail(sessionId: string, error: unknown) {
      push([{ type: 'session.error', properties: { sessionID: sessionId, error } }]);
      finish(error);
    },
    endStream,
    abort,
    subscribe,
    setPromptHandler: (handler: typeof onPrompt) => {
      promptHandler = handler;
    },
  };
}

function installDeps(servers: Array<ReturnType<typeof fakeServer>>, spawnFailures: Error[] = []) {
  let spawned = 0;
  let current: ReturnType<typeof fakeServer> | undefined;
  const spawnServer = mock(async (_configuration: Record<string, unknown>) => {
    const failure = spawnFailures.shift();
    if (failure) throw failure;
    current = servers[spawned];
    if (!current) throw new Error(`test: no fake server for spawn #${spawned + 1}`);
    spawned += 1;
    return { url: `http://127.0.0.1:0/${spawned}`, proc: current.proc };
  });
  const deps: OpenCodeSharedRuntimeDeps = {
    spawnServer,
    createClient: () => current!.client,
    createQuestionClient: () => current!.questionClient,
  };
  setSharedRuntimeDepsForTesting(deps);
  return { spawnServer };
}

function newProvider(hook = MEMORY_HOOK): OpenCodeProvider {
  const provider = new OpenCodeProvider({});
  provider.registerMemorySessionHook(hook);
  return provider;
}

async function collect(events: AsyncIterable<ProviderEvent>): Promise<ProviderEvent[]> {
  const out: ProviderEvent[] = [];
  for await (const event of events) out.push(event);
  return out;
}

async function runOneTurn(provider: OpenCodeProvider, continuation?: string): Promise<ProviderEvent[]> {
  const query = provider.query({ prompt: 'hi', cwd: CWD, continuation });
  query.end();
  return collect(query.events);
}

const resultText = (events: ProviderEvent[]) =>
  events.filter((e) => e.type === 'result').map((e) => (e as { text: string | null }).text);

let composedFactory: ReturnType<typeof resetAgentMailboxForTesting>;
let memoryDir: string;
let savedXdg: string | undefined;
beforeEach(() => {
  composedFactory = resetAgentMailboxForTesting();
  initTestSessionDb();
  registerAgentMailbox(() => new SqliteAgentMailbox());
  savedXdg = process.env.XDG_DATA_HOME;
  memoryDir = mkdtempSync(path.join(tmpdir(), 'opencode-runtime-memory-'));
  process.env.XDG_DATA_HOME = memoryDir;
  destroySharedRuntime();
});
afterEach(() => {
  destroySharedRuntime();
  setSharedRuntimeDepsForTesting(undefined);
  if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = savedXdg;
  resetAgentMailboxForTesting();
  closeSessionDb();
  if (composedFactory) registerAgentMailbox(composedFactory);
  rmSync(memoryDir, { recursive: true, force: true });
});

describe('shared runtime recovery', () => {
  it('routes question.asked through the production event pump before native work continues', async () => {
    let sessionId = '';
    const replies: Array<{ requestID: string; answers: string[][] }> = [];
    const server = fakeServer((sid) => {
      sessionId = sid;
      server.push([
        { type: 'question.asked', properties: { id: 'que_fixture', sessionID: 'ses_other', questions: [{}] } },
      ]);
    });
    server.questionClient.question.reply = async (params) => {
      replies.push(params);
      server.reply(sessionId, 'continued after steering');
      return { data: true };
    };
    installDeps([server]);
    // No hook sources, so no subprocess: a hook spawn stalled by host load
    // would hold prepare() past the watchdog and Bun's test timeout.
    const query = newProvider({ ...MEMORY_HOOK, sources: [] }).query({ prompt: 'work', cwd: CWD });
    query.end();
    // A missing routing branch must fail promptly rather than waiting for
    // the production idle watchdog.
    const timer = setTimeout(() => query.abort(), 1000);
    try {
      expect(resultText(await collect(query.events))).toEqual(['continued after steering']);
      expect(replies).toHaveLength(1);
      expect(replies[0].requestID).toBe('que_fixture');
      expect(replies[0].answers[0][0]).toContain('ask_user_question');
      expect(server.abort).not.toHaveBeenCalled();
    } finally {
      clearTimeout(timer);
      query.abort();
    }
  });

  for (const partial of [false, true]) {
    it(`completes a native error once without a retry, with prior text: ${partial}`, async () => {
      getInboundDb()
        .prepare(
          `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('main', 'main', 'channel', 'discord', 'chan-1', NULL)`,
        )
        .run();
      const server = fakeServer((sid) => {
        if (partial) server.push(assistantReply(sid, '<message to="main">Completed before failure.</message>'));
        server.fail(sid, {
          name: 'APIError',
          data: {
            message: 'backend failed',
            isRetryable: false,
            responseBody: '<message to="main">RAW_DIAGNOSTIC_MUST_NOT_DELIVER</message>',
            responseHeaders: { 'x-fixture': 'RAW_HEADER' },
          },
        });
      });
      installDeps([server]);
      const query = newProvider().query({ prompt: 'work', cwd: CWD });
      query.push = mock(query.push);
      query.end();
      const exchanges: ProviderExchange[] = [];
      await processQuery(
        query,
        { platformId: 'chan-1', channelType: 'discord', threadId: null, inReplyTo: 'm1', taskRun: false },
        ['m1'],
        'opencode',
        (exchange) => exchanges.push(exchange),
        'work',
        undefined,
        true, // runPollLoop passes the OpenCode contract's mid-turn delivery
      );
      expect(exchanges).toHaveLength(1);
      expect(exchanges[0].result ?? '').not.toContain('backend failed');
      expect(exchanges[0].result ?? '').not.toContain('RAW_DIAGNOSTIC_MUST_NOT_DELIVER');
      const sent = getUndeliveredMessages()
        .filter((row) => row.kind === 'chat')
        .map((row) => (JSON.parse(row.content) as { text: string }).text);
      expect(sent).toEqual([
        ...(partial ? ['Completed before failure.'] : []),
        "Sorry, something went wrong and I couldn't answer. Whoever runs this NanoClaw can look into it using the logs: https://docs.nanoclaw.dev/operate/troubleshooting#start-here",
      ]);
      expect(exchanges[0].status).toBe('error');
      expect(query.push).not.toHaveBeenCalled();
      expect(server.abort).not.toHaveBeenCalled();
    });
  }

  async function chatTurn(onPrompt: (server: ReturnType<typeof fakeServer>, sid: string) => void) {
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('main', 'main', 'channel', 'discord', 'chan-1', NULL)`,
      )
      .run();
    const server: ReturnType<typeof fakeServer> = fakeServer((sid) => onPrompt(server, sid));
    const prompts: string[] = [];
    const prompt = server.client.session.prompt;
    server.client.session.prompt = ((params) => {
      prompts.push((params.body.parts as Array<{ text: string }>)[0].text);
      return prompt(params);
    }) as OpenCodeSessionClient['prompt'];
    installDeps([server]);
    const query = newProvider().query({ prompt: 'work', cwd: CWD });
    query.push = mock(query.push);
    query.end();
    const exchanges: ProviderExchange[] = [];
    await processQuery(
      query,
      { platformId: 'chan-1', channelType: 'discord', threadId: null, inReplyTo: 'm1', taskRun: false },
      ['m1'],
      'opencode',
      (exchange) => exchanges.push(exchange),
      'work',
      undefined,
      true,
    );
    const sent = getUndeliveredMessages()
      .filter((row) => row.kind === 'chat')
      .map((row) => (JSON.parse(row.content) as { text: string }).text);
    return { sent, exchanges, prompts, push: query.push as ReturnType<typeof mock> };
  }

  it('delivers the wrapped answer once and never sends the narration of earlier steps', async () => {
    const turn = await chatTurn((server, sid) => {
      server.push(assistantReply(sid, 'Review request for PR #1, following the review workflow.'));
      server.reply(sid, '<message to="main">verdict</message>');
    });
    expect(turn.sent).toEqual(['verdict']);
    expect(turn.exchanges).toHaveLength(1);
    expect(turn.exchanges[0].result).toBe('<message to="main">verdict</message>');
    expect(turn.push).not.toHaveBeenCalled();
  });

  it('answers a plain-text reply with one wrap reminder, as for Claude', async () => {
    const turn = await chatTurn((server, sid) => server.reply(sid, 'The gate blocked it this time.'));
    expect(turn.sent).toEqual([]);
    expect(turn.push).toHaveBeenCalledTimes(1);
    expect(String(turn.push.mock.calls[0][0])).toContain('not wrapped in <message to="name">');
  });

  describe('a retryable model error after OpenCode gives up', () => {
    // The error prod recorded on 2026-11-16 once OpenCode's own five retries were spent.
    const RATE_LIMITED = {
      name: 'APIError',
      data: {
        message: 'Too Many Requests',
        statusCode: 429,
        isRetryable: true,
        responseHeaders: { 'x-amzn-waf-action': 'BLOCK', 'x-amzn-waf-rule': 'CPE_RateLimit_IP' },
        responseBody: '',
      },
    };
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
      for (const name of ['OPENCODE_MODEL_RETRY_BASE_MS', 'OPENCODE_MODEL_RETRY_BUDGET_MS'])
        saved[name] = process.env[name];
      process.env.OPENCODE_MODEL_RETRY_BASE_MS = '1';
    });
    afterEach(() => {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    });

    it('retries with a note to continue, keeps completed steps, and answers once', async () => {
      let attempt = 0;
      const turn = await chatTurn((server, sid) => {
        attempt += 1;
        if (attempt === 1) {
          server.push(assistantReply(sid, '<message to="main">Step one done.</message>'));
          server.fail(sid, RATE_LIMITED);
        } else if (attempt === 2) {
          server.fail(sid, RATE_LIMITED);
        } else {
          server.reply(sid, '<message to="main">verdict</message>');
        }
      });
      // The completed step went out once; no failure notice; the answer went out once.
      expect(turn.sent).toEqual(['Step one done.', 'verdict']);
      expect(turn.exchanges).toHaveLength(1);
      expect(turn.exchanges[0].status).toBe('completed');
      expect(turn.exchanges[0].result).toBe('<message to="main">verdict</message>');
      // The prompt went once; each retry sent the note, never the prompt again.
      expect(turn.prompts).toHaveLength(3);
      expect(turn.prompts[0]).toBe('work');
      for (const retry of turn.prompts.slice(1)) {
        expect(retry).toContain('This is an automatic retry');
        expect(retry).toContain('Do not repeat a step');
      }
    });

    it('fails the turn as before once the retry budget is spent', async () => {
      process.env.OPENCODE_MODEL_RETRY_BUDGET_MS = '0';
      const turn = await chatTurn((server, sid) => server.fail(sid, RATE_LIMITED));
      expect(turn.prompts).toEqual(['work']);
      expect(turn.exchanges).toHaveLength(1);
      expect(turn.exchanges[0].status).toBe('error');
      expect(turn.sent).toHaveLength(1);
      expect(turn.sent[0]).toContain("couldn't answer");
    });

    it('ends the turn with one result and one usage that charges every attempt', async () => {
      // One billed step per attempt; the first attempt then hits the 429.
      const step = (sid: string, id: string, input: number): Ev => ({
        type: 'message.updated',
        properties: {
          info: { id, role: 'assistant', sessionID: sid, modelID: 'glm-5.3', tokens: { input, output: 10 } },
        },
      });
      const server = fakeServer((sid, promptIndex) => {
        if (promptIndex === 1) {
          server.push([step(sid, 'msg_step_1', 100)]);
          server.fail(sid, RATE_LIMITED);
        } else {
          server.push([step(sid, 'msg_step_2', 50)]);
          server.reply(sid, 'recovered');
        }
      });
      installDeps([server]);
      const events = await runOneTurn(newProvider());
      const kinds = events.map((event) => event.type).filter((type) => type !== 'text');
      // No `usage` before the result: the poll loop's cost hard stop runs at
      // `usage` and must only see the turn boundary.
      expect(kinds[0]).toBe('init');
      expect(kinds[1]).toBe('error');
      expect(kinds.slice(2, -2).every((type) => type === 'activity')).toBe(true);
      expect(kinds.slice(2, -2).length).toBeGreaterThan(0);
      expect(kinds.slice(-2)).toEqual(['result', 'usage']);
      expect(events.find((event) => event.type === 'error')).toMatchObject({ retryable: true });
      expect(resultText(events)).toEqual(['recovered']);
      const usage = events.find((event) => event.type === 'usage') as { turnTokens?: unknown[]; inputTokens: number };
      expect(usage.inputTokens).toBe(150);
      expect(usage.turnTokens).toEqual([
        expect.objectContaining({ model: 'glm-5.3', inputTokens: 150, outputTokens: 20 }),
      ]);
    });

    it('charges the failed attempt when the query is aborted while it waits to retry', async () => {
      process.env.OPENCODE_MODEL_RETRY_BASE_MS = '60000';
      const server = fakeServer((sid) => {
        server.push([
          {
            type: 'message.updated',
            properties: {
              info: { id: 'msg_step', role: 'assistant', sessionID: sid, modelID: 'glm-5.3', tokens: { input: 100 } },
            },
          },
        ]);
        server.fail(sid, RATE_LIMITED);
      });
      installDeps([server]);
      const query = newProvider().query({ prompt: 'hi', cwd: CWD });
      query.end();
      const events: ProviderEvent[] = [];
      for await (const event of query.events) {
        events.push(event);
        if (event.type === 'error') setTimeout(() => query.abort(), 10);
      }
      const kinds = events.map((event) => event.type);
      expect(kinds).not.toContain('result');
      expect(kinds.at(-1)).toBe('usage');
      expect(events.at(-1)).toMatchObject({ isError: true, inputTokens: 100 });
    });
  });

  describe('a step cut off at the output token limit', () => {
    // The step prod recorded on 2026-11-16: all 4096 tokens spent reasoning,
    // finish reason `length`, no text.
    const cutOff = (sid: string, id: string): Ev => ({
      type: 'message.updated',
      properties: {
        info: {
          id,
          role: 'assistant',
          sessionID: sid,
          finish: 'length',
          modelID: 'glm-5.3',
          tokens: { input: 100, output: 1, reasoning: 4095 },
        },
      },
    });

    it('continues after a cut-off step with a note instead of the prompt, and answers once', async () => {
      let attempt = 0;
      const turn = await chatTurn((server, sid) => {
        attempt += 1;
        if (attempt === 1) {
          server.push([cutOff(sid, 'msg_cut_1')]);
          server.finish();
        } else {
          server.reply(sid, '<message to="main">verdict</message>');
        }
      });
      expect(turn.prompts).toEqual(['work', OUTPUT_LIMIT_CONTINUE_PROMPT]);
      expect(turn.sent).toEqual(['verdict']);
      expect(turn.exchanges).toHaveLength(1);
      expect(turn.exchanges[0].status).toBe('completed');
      expect(turn.exchanges[0].result).toBe('<message to="main">verdict</message>');
      // The turn answered, so the poll loop's silent-turn nudge never fired.
      expect(turn.push).not.toHaveBeenCalled();
    });

    it('stops continuing after MAX_OUTPUT_LIMIT_CONTINUES and leaves the turn to the silent-turn path', async () => {
      let attempt = 0;
      const turn = await chatTurn((server, sid) => {
        attempt += 1;
        server.push([cutOff(sid, `msg_cut_${attempt}`)]);
        server.finish();
      });
      expect(turn.prompts).toEqual([
        'work',
        ...Array.from({ length: MAX_OUTPUT_LIMIT_CONTINUES }, () => OUTPUT_LIMIT_CONTINUE_PROMPT),
      ]);
      // The poll loop handles the empty turn as before: one re-send nudge (a
      // no-op here, the query has ended), then its fixed notice.
      expect(turn.push).toHaveBeenCalledTimes(1);
      expect(String(turn.push.mock.calls[0][0])).toContain('produced NO output');
      expect(turn.sent).toHaveLength(1);
      expect(turn.sent[0]).toContain('without producing any output');
    });

    it('does not continue a step that ended normally', async () => {
      const turn = await chatTurn((server, sid) => {
        server.push([
          {
            type: 'message.updated',
            properties: { info: { id: 'msg_done', role: 'assistant', sessionID: sid, finish: 'stop' } },
          },
          {
            type: 'message.part.updated',
            properties: {
              part: { type: 'text', messageID: 'msg_done', sessionID: sid, text: '<message to="main">done</message>' },
            },
          },
        ]);
        server.finish();
      });
      expect(turn.prompts).toEqual(['work']);
      expect(turn.sent).toEqual(['done']);
    });

    it('ends the turn with one result and one usage that charges every step', async () => {
      const server = fakeServer((sid, promptIndex) => {
        if (promptIndex === 1) {
          server.push([cutOff(sid, 'msg_cut_1')]);
          server.finish();
        } else {
          server.push([
            {
              type: 'message.updated',
              properties: {
                info: {
                  id: 'msg_done',
                  role: 'assistant',
                  sessionID: sid,
                  finish: 'stop',
                  modelID: 'glm-5.3',
                  tokens: { input: 50, output: 10 },
                },
              },
            },
          ]);
          server.reply(sid, 'recovered');
        }
      });
      installDeps([server]);
      const events = await runOneTurn(newProvider());
      const kinds = events.map((event) => event.type).filter((type) => type !== 'text' && type !== 'activity');
      expect(kinds).toEqual(['init', 'result', 'usage']);
      expect(resultText(events)).toEqual(['recovered']);
      const usage = events.find((event) => event.type === 'usage') as { turnTokens?: unknown[]; inputTokens: number };
      expect(usage.inputTokens).toBe(150);
      expect(usage.turnTokens).toEqual([
        expect.objectContaining({ model: 'glm-5.3', inputTokens: 150, outputTokens: 4096 + 10 }),
      ]);
    });
  });

  it('retries the spawn on the next query instead of caching the rejection', async () => {
    const server = fakeServer((sid) => server.reply(sid, 'back'));
    const { spawnServer } = installDeps([server], [new Error('Timeout waiting for OpenCode server to start')]);
    const provider = newProvider();

    await expect(runOneTurn(provider)).rejects.toThrow('Timeout waiting for OpenCode server');
    expect(resultText(await runOneTurn(provider))).toEqual(['back']);
    expect(spawnServer).toHaveBeenCalledTimes(2);
  });

  it('kills a server whose client setup fails after the spawn, and respawns next time', async () => {
    const broken = fakeServer(() => {});
    broken.subscribe.mockImplementationOnce(async () => {
      throw new Error('subscribe exploded');
    });
    const healthy = fakeServer((sid) => healthy.reply(sid, 'ok'));
    const { spawnServer } = installDeps([broken, healthy]);
    const provider = newProvider();

    await expect(runOneTurn(provider)).rejects.toThrow('subscribe exploded');
    expect(broken.proc.kill).toHaveBeenCalledTimes(1);

    expect(resultText(await runOneTurn(provider))).toEqual(['ok']);
    expect(spawnServer).toHaveBeenCalledTimes(2);
  });

  it('respawns after the server process exits between turns', async () => {
    const first = fakeServer((sid) => first.reply(sid, 'one'));
    const second = fakeServer((sid) => second.reply(sid, 'two'));
    const { spawnServer } = installDeps([first, second]);
    const provider = newProvider();

    expect(resultText(await runOneTurn(provider))).toEqual(['one']);
    first.proc.emitExit(137);

    expect(resultText(await runOneTurn(provider))).toEqual(['two']);
    expect(spawnServer).toHaveBeenCalledTimes(2);
  });

  it('server exit mid-turn fails the in-flight query promptly, keeps the continuation, and respawns', async () => {
    const dying = fakeServer(() => {
      // Prompt accepted, then the server is SIGKILLed before any event.
      setTimeout(() => dying.proc.emitExit(137), 20);
    });
    const healthy = fakeServer((sid) => healthy.reply(sid, 'ok'));
    const { spawnServer } = installDeps([dying, healthy]);
    const provider = newProvider();

    let thrown: unknown;
    const started = Date.now();
    await runOneTurn(provider, 'ses_kept').catch((err: unknown) => {
      thrown = err;
    });
    expect((thrown as Error).message).toContain('OpenCode event stream ended unexpectedly');
    expect(Date.now() - started).toBeLessThan(2000);
    // The session on disk is intact: a dead server is not a stale session.
    expect(provider.isSessionInvalid(thrown)).toBe(false);
    // The subscription was opened with an abort signal and it was aborted.
    expect(dying.subscribe.mock.calls[0][0]?.signal?.aborted).toBe(true);
    // No retry cap: the SDK counts attempts cumulatively per subscription, so
    // a cap would end a long-lived stream on the Nth transient hiccup.
    expect((dying.subscribe.mock.calls[0][0] as { sseMaxRetryAttempts?: number })?.sseMaxRetryAttempts).toBeUndefined();

    expect(resultText(await runOneTurn(provider))).toEqual(['ok']);
    expect(spawnServer).toHaveBeenCalledTimes(2);
  });

  it('drops the runtime when the event stream ends mid-turn so the next query respawns', async () => {
    const dying = fakeServer(() => dying.endStream());
    const healthy = fakeServer((sid) => healthy.reply(sid, 'ok'));
    const { spawnServer } = installDeps([dying, healthy]);
    const provider = newProvider();

    await expect(runOneTurn(provider)).rejects.toThrow('OpenCode event stream ended unexpectedly');
    expect(dying.proc.kill).toHaveBeenCalledTimes(1);

    expect(resultText(await runOneTurn(provider))).toEqual(['ok']);
    expect(spawnServer).toHaveBeenCalledTimes(2);
  });

  it('reuses one server across queries when nothing went wrong', async () => {
    const server = fakeServer((sid, n) => server.reply(sid, `r${n}`));
    const { spawnServer } = installDeps([server]);
    const provider = newProvider();

    expect(resultText(await runOneTurn(provider))).toEqual(['r1']);
    expect(resultText(await runOneTurn(provider, 'ses_1'))).toEqual(['r2']);
    expect(spawnServer).toHaveBeenCalledTimes(1);
    expect(server.proc.kill).not.toHaveBeenCalled();
  });

  it('does not finish a native prompt when its event stream reports idle or a recoverable error', async () => {
    let sessionId = '';
    const server = fakeServer((sid) => {
      sessionId = sid;
    });
    installDeps([server]);
    let settled = false;
    const result = runOneTurn(newProvider()).finally(() => {
      settled = true;
    });
    while (!sessionId) await Bun.sleep(1);
    server.push(assistantReply(sessionId, 'verified text'));
    server.push([
      { type: 'session.error', properties: { sessionID: sessionId, error: { name: 'ContextOverflowError' } } },
    ]);
    await Bun.sleep(10);
    expect(settled).toBe(false);
    server.finish();
    expect(resultText(await result)).toEqual(['verified text']);
    expect(server.abort).not.toHaveBeenCalled();
  });
});

describe('isSessionInvalid', () => {
  const provider = newProvider();

  it("fires only on OpenCode's own NotFoundError for the session", () => {
    expect(
      provider.isSessionInvalid(
        new Error('OpenCode prompt: {"name":"NotFoundError","data":{"message":"Session not found: ses_gone"}}'),
      ),
    ).toBe(true);
  });

  it('keeps the continuation on backend, proxy and watchdog errors', () => {
    for (const msg of [
      '404 No endpoints found',
      'OpenCode retry limit (3): 404 No endpoints found',
      'read ECONNRESET',
      'connection reset by peer',
      'OpenCode event stream silent for 60000ms; server dropped',
      'OpenCode turn produced no activity for 900000ms; aborted',
      'OpenCode SSE stream ended unexpectedly',
      'OpenCode prompt: {}',
    ]) {
      expect(provider.isSessionInvalid(new Error(msg))).toBe(false);
    }
  });

  it('a backend 404 surfaced as session.error is a turn error, not a stale session', async () => {
    const server = fakeServer((sid) =>
      server.fail(sid, { name: 'APIError', data: { message: '404 No endpoints found' } }),
    );
    installDeps([server]);
    const provider = newProvider();

    const result = (await runOneTurn(provider, 'ses_1')).find((event) => event.type === 'result');
    expect(result?.isError).toBe(true);
    expect(result?.text).toBeNull();
    expect(provider.isSessionInvalid(new Error('404 No endpoints found'))).toBe(false);
  });

  it.each(['APIError', 'ProviderAuthError'])(
    'an authentication failure (%s) preserves the resumable session contract',
    async (name) => {
      const server = fakeServer((sid) =>
        server.fail(sid, { name, data: { statusCode: 401, message: 'Authentication failed' } }),
      );
      installDeps([server]);
      const provider = newProvider();
      const result = (await runOneTurn(provider, 'ses_1')).find((event) => event.type === 'result');
      expect(result?.isError).toBe(true);
      expect(result?.text).toBeNull();
      expect(provider.isSessionInvalid(new Error('Authentication failed'))).toBe(false);
    },
  );

  it('a prompt NotFoundError for the resumed id is a stale session', async () => {
    const server = fakeServer(() => {});
    server.client.session.prompt = async () => ({
      error: { name: 'NotFoundError', data: { message: 'Session not found: ses_gone' } },
    });
    installDeps([server]);
    const provider = newProvider();

    let thrown: unknown;
    await runOneTurn(provider, 'ses_gone').catch((err: unknown) => {
      thrown = err;
    });
    expect(provider.isSessionInvalid(thrown)).toBe(true);
  });
});

describe('abort and watchdog', () => {
  it('suppresses a runtime startup error after the query was aborted', async () => {
    let rejectRuntime!: (error: Error) => void;
    const provider = new OpenCodeProvider(
      {},
      {
        getRuntime: () =>
          new Promise((_, reject) => {
            rejectRuntime = reject;
          }),
      },
    );
    provider.registerMemorySessionHook(MEMORY_HOOK);
    const query = provider.query({ prompt: 'work', cwd: CWD });
    const first = query.events[Symbol.asyncIterator]().next();

    query.abort();
    rejectRuntime(new Error('server startup failed'));

    await expect(first).resolves.toEqual({ done: true, value: undefined });
  });

  it('abort() stops the in-flight session and keeps the shared server', async () => {
    let promptSent!: () => void;
    const prompted = new Promise<void>((resolve) => {
      promptSent = resolve;
    });
    const server = fakeServer(() => promptSent());
    const { spawnServer } = installDeps([server]);
    const provider = newProvider();

    const query = provider.query({ prompt: 'work', cwd: CWD });
    const iterator = query.events[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ type: 'init', continuation: 'ses_1' });

    // Abort only once the prompt is in flight: `prepare` spawns the memory
    // hook first, so a fixed sleep can abort before the prompt is sent.
    const pendingNext = iterator.next();
    await prompted;
    query.abort();

    // What the server sends back for the aborted session (the fake abort
    // emits it) must not become this query's error.
    expect((await pendingNext).done).toBe(true);
    expect(server.abort).toHaveBeenCalledTimes(1);
    expect(server.abort.mock.calls[0][0]).toMatchObject({ path: { id: 'ses_1' } });
    expect(server.proc.kill).not.toHaveBeenCalled();

    // The next query lands on the same server.
    const again = provider.query({ prompt: 'again', cwd: CWD });
    again.end();
    const promptedOn: string[] = [];
    server.setPromptHandler((sid) => {
      promptedOn.push(sid);
      server.reply(sid, 'fresh');
    });
    expect(resultText(await collect(again.events))).toEqual(['fresh']);
    expect(promptedOn).toEqual(['ses_2']);
    expect(spawnServer).toHaveBeenCalledTimes(1);
  });

  it('abort() while parked in session.create() sends no prompt', async () => {
    const server = fakeServer(() => {});
    let releaseCreate: (() => void) | undefined;
    const realCreate = server.client.session.create;
    server.client.session.create = async () => {
      await new Promise<void>((resolve) => {
        releaseCreate = resolve;
      });
      return realCreate();
    };
    const prompt = mock(server.client.session.prompt);
    server.client.session.prompt = prompt;
    installDeps([server]);
    const provider = newProvider();

    const query = provider.query({ prompt: 'work', cwd: CWD });
    const iterator = query.events[Symbol.asyncIterator]();
    const first = iterator.next();
    while (!releaseCreate) await new Promise((r) => setTimeout(r, 1));

    query.abort();
    releaseCreate();
    expect((await first).done).toBe(true);

    expect(prompt).not.toHaveBeenCalled();
    expect(server.abort).not.toHaveBeenCalled();
  });

  describe('with short watchdog budgets', () => {
    const saved: Record<string, string | undefined> = {};
    const KEYS = ['OPENCODE_IDLE_TIMEOUT_MS', 'OPENCODE_STREAM_SILENCE_MS'] as const;
    beforeEach(() => {
      for (const k of KEYS) saved[k] = process.env[k];
    });
    afterEach(() => {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    });

    it('stream tier: heartbeats keep a quiet tool run alive; only agent events count as activity', async () => {
      process.env.OPENCODE_STREAM_SILENCE_MS = '150';
      process.env.OPENCODE_IDLE_TIMEOUT_MS = '10000';
      const server = fakeServer((sid) => {
        // A tool that streams nothing for well over the silence budget while
        // the server's heartbeat keeps ticking, then the reply.
        let ticks = 0;
        const beat = setInterval(() => {
          server.push([{ type: 'server.heartbeat', properties: {} }]);
          ticks += 1;
          if (ticks >= 12) {
            clearInterval(beat);
            server.reply(sid, 'done after a long tool');
          }
        }, 40);
      });
      installDeps([server]);
      const provider = newProvider();

      const events = await runOneTurn(provider);
      expect(resultText(events)).toEqual(['done after a long tool']);
      expect(server.proc.kill).not.toHaveBeenCalled();
      expect(server.abort).not.toHaveBeenCalled();
      expect(events.filter((e) => e.type === 'activity').length).toBeLessThanOrEqual(2);
    });

    it('stream tier: silence including heartbeats drops the server as genuine death', async () => {
      process.env.OPENCODE_STREAM_SILENCE_MS = '150';
      process.env.OPENCODE_IDLE_TIMEOUT_MS = '10000';
      const server = fakeServer(() => {});
      installDeps([server]);
      const provider = newProvider();

      await expect(runOneTurn(provider)).rejects.toThrow('OpenCode event stream silent for 150ms');
      expect(server.proc.kill).toHaveBeenCalledTimes(1);
      expect(server.abort).toHaveBeenCalledTimes(1);
    });

    it('activity tier: a wedged backend on a live stream aborts the session and keeps the server', async () => {
      process.env.OPENCODE_STREAM_SILENCE_MS = '10000';
      process.env.OPENCODE_IDLE_TIMEOUT_MS = '150';
      const server = fakeServer(() => {
        const beat = setInterval(() => server.push([{ type: 'server.heartbeat', properties: {} }]), 40);
        setTimeout(() => clearInterval(beat), 2000);
      });
      const { spawnServer } = installDeps([server]);
      const provider = newProvider();

      await expect(runOneTurn(provider)).rejects.toThrow('OpenCode turn produced no activity for 150ms; aborted');
      expect(server.abort).toHaveBeenCalledTimes(1);
      expect(server.abort.mock.calls[0][0]).toMatchObject({ path: { id: 'ses_1' } });
      expect(server.proc.kill).not.toHaveBeenCalled();
      // A backend wedge is not a stale session: the continuation must survive.
      expect(provider.isSessionInvalid(new Error('OpenCode turn produced no activity for 150ms; aborted'))).toBe(false);

      // The server is still the one we had.
      server.setPromptHandler((sid) => server.reply(sid, 'recovered'));
      expect(resultText(await runOneTurn(provider))).toEqual(['recovered']);
      expect(spawnServer).toHaveBeenCalledTimes(1);
    });
  });
});

describe('SDK stream cleanup', () => {
  it('handles an asynchronous AbortError from the stream return operation', async () => {
    const server = fakeServer((sid) => server.reply(sid, 'done'));
    const subscribe = server.subscribe.getMockImplementation()!;
    const returnStream = mock(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    server.subscribe.mockImplementationOnce(async (options) => {
      const subscription = await subscribe(options);
      subscription.stream.return = returnStream;
      return subscription;
    });
    installDeps([server]);
    await runOneTurn(newProvider());
    destroySharedRuntime();
    await Bun.sleep(0);
    expect(returnStream).toHaveBeenCalled();
  });
});

describe('runtime contract consumption', () => {
  it('uses the core-resolved configuration even if environment defaults change before query', async () => {
    const server = fakeServer((sid) => server.reply(sid, 'configured'));
    const { spawnServer } = installDeps([server]);
    const saved = { ...process.env };
    try {
      process.env.OPENCODE_PROVIDER = 'openai';
      process.env.OPENCODE_MODEL = 'openai/default';
      process.env.ANTHROPIC_BASE_URL = 'http://localhost:8891/v1';
      const provider = createProvider('opencode', { model: 'openai/group-model', effort: 'high' });
      registerProviderMemorySessionHook('opencode', provider, MEMORY_HOOK);
      process.env.OPENCODE_PROVIDER = 'anthropic';
      process.env.OPENCODE_MODEL = 'changed-after-resolution';
      await runOneTurn(provider as OpenCodeProvider);
      expect(spawnServer.mock.calls[0][0]).toMatchObject({
        model: 'openai/group-model',
        enabled_providers: ['openai'],
        permission: { question: 'deny', bash: 'allow' },
        provider: { openai: { models: { 'group-model': { options: { reasoningEffort: 'high' } } } } },
      });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  });

  it('restarts the shared server when effective effort changes', async () => {
    const first = fakeServer((sid) => first.reply(sid, 'one'));
    const second = fakeServer((sid) => second.reply(sid, 'two'));
    const { spawnServer } = installDeps([first, second]);
    const config = (effort: string) => ({
      executionPolicy: { question: 'deny' },
      inference: { model: 'openai/test', provider: { openai: { options: { reasoningEffort: effort } } } },
      mcpServers: {},
    });
    for (const effort of ['low', 'high']) {
      const provider = new OpenCodeProvider({}, undefined, config(effort));
      provider.registerMemorySessionHook(MEMORY_HOOK);
      await runOneTurn(provider);
    }
    expect(spawnServer).toHaveBeenCalledTimes(2);
    expect(first.proc.kill).toHaveBeenCalled();
  });
});
