/**
 * Idle-end of a query whose provider stream never closes.
 *
 * Prod: a turn completed, 1200 s later the poller logged "No SDK events for
 * 1200s, ending query" — and then logged it again every 0.5 s for hours. The
 * Claude SDK stream did not close after query.end(), so processQuery never
 * returned, nothing recorded that the query was already ended, and the stale
 * lastEventTime kept the idle check true on every tick. A follow-up that
 * arrived meanwhile was pushed into the closed input stream (never read) and
 * acked 'completed' — lost.
 *
 * Time is driven with setSystemTime so the 20-minute idle limit is crossed
 * without waiting; the poller interval is shortened through the test seam.
 */
import { afterEach, beforeEach, describe, expect, it, setSystemTime, spyOn } from 'bun:test';

import { getPendingMessages } from './db/messages-in.js';
import { getUndeliveredMessages } from './db/messages-out.js';
import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { IDLE_END_GRACE_MS, idleEndLimit, processQuery, runPollLoop } from './poll-loop.js';
import type { AgentProvider, AgentQuery, ProviderEvent } from './providers/types.js';

const POLL_MS = 10;
const ROUTING = { platformId: 'channel-1', channelType: 'slack', threadId: 'thread-a', inReplyTo: 'm1' };
const TASK_ROUTING = { platformId: null, channelType: null, threadId: null, inReplyTo: 'm1', taskRun: true };
const CONTRACT = { textDelivery: 'mid-turn-complete', commands: { formatting: 'xml' } } as const;

function insertMessage(id: string, text: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO messages_in
       (id, kind, timestamp, status, trigger, platform_id, channel_type, thread_id, content)
       VALUES (?, 'chat', ?, 'pending', 1, 'channel-1', 'slack', 'thread-a', ?)`,
    )
    .run(id, new Date().toISOString(), JSON.stringify({ text }));
}

function ackStatus(id: string): string | undefined {
  const row = getOutboundDb().prepare('SELECT status FROM processing_ack WHERE message_id = ?').get(id) as
    | { status: string }
    | undefined;
  return row?.status;
}

/** Real-time wait. Date.now() is frozen by setSystemTime, so count iterations instead. */
async function waitFor(predicate: () => boolean, what: string, maxMs = 3_000): Promise<void> {
  for (let waited = 0; !predicate(); waited += 10) {
    if (waited >= maxMs) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let t0 = 0;
/** Jump past the 20-minute no-events limit. */
const goIdle = () => setSystemTime(new Date(t0 + idleEndLimit(0) + 1_000));
/** Jump past the idle limit AND the post-end grace window. */
const goPastGrace = () => setSystemTime(new Date(t0 + idleEndLimit(0) + 1_000 + IDLE_END_GRACE_MS + 1_000));

/**
 * A query with the Claude provider's failure shape: one answered turn, then the
 * event stream never closes — not on end(), not on abort(). Like the SDK's
 * MessageStream, input pushed after end() is never read.
 */
function stuckQuery(answer: string) {
  const state = {
    parked: false,
    ended: false,
    endCalls: 0,
    abortCalls: 0,
    killCalls: 0,
    accepted: [] as string[],
    dropped: [] as string[],
  };
  async function* events(): AsyncGenerator<ProviderEvent> {
    yield { type: 'init', continuation: 'sess-stuck' };
    yield { type: 'text', text: `<message to="main">${answer}</message>` };
    yield { type: 'result', text: '' };
    state.parked = true;
    await new Promise<never>(() => {});
  }
  const query: AgentQuery = {
    events: events(),
    push: (prompt) => (state.ended ? state.dropped : state.accepted).push(prompt),
    end: () => {
      state.ended = true;
      state.endCalls += 1;
    },
    abort: () => {
      state.abortCalls += 1;
    },
    kill: () => {
      state.killCalls += 1;
    },
  };
  return { query, state };
}

/** Run processQuery on a stuck query until its first turn is answered and the stream parks. */
async function startStuck() {
  const { query, state } = stuckQuery('answer one');
  let returned = false;
  const run = processQuery(query, ROUTING, ['m1'], 'claude', undefined, 'prompt', undefined, true, undefined, POLL_MS);
  void run.then(
    () => (returned = true),
    () => (returned = true),
  );
  await waitFor(() => state.parked, 'the first turn to complete');
  expect(ackStatus('m1')).toBe('completed');
  return { state, run, returned: () => returned };
}

beforeEach(() => {
  initTestSessionDb();
  getInboundDb().exec(
    `INSERT INTO destinations (name, display_name, type, channel_type, platform_id)
     VALUES ('main', 'Main', 'channel', 'slack', 'channel-1')`,
  );
  t0 = Date.now();
  setSystemTime(new Date(t0));
});
afterEach(() => {
  setSystemTime();
  closeSessionDb();
});

describe('idle-end of a query whose provider stream never closes', () => {
  it('fires the idle end once, not again on every poll tick', async () => {
    const logs = spyOn(console, 'error');
    try {
      const { state, run, returned } = await startStuck();
      goIdle();
      await waitFor(() => state.endCalls > 0, 'the idle end');
      await sleep(POLL_MS * 20);
      expect(state.endCalls).toBe(1);
      expect(logs.mock.calls.filter((c) => String(c[0]).includes('No SDK events for'))).toHaveLength(1);

      goPastGrace();
      await waitFor(returned, 'processQuery to return');
      await run;
    } finally {
      logs.mockRestore();
    }
  });

  it('never claims, pushes or acks a follow-up into the idle-ended query', async () => {
    const { state, run, returned } = await startStuck();
    goIdle();
    await waitFor(() => state.endCalls > 0, 'the idle end');

    insertMessage('f1', 'are you there?');
    await sleep(POLL_MS * 20);
    expect(state.dropped).toEqual([]);
    expect(state.accepted).toEqual([]);
    expect(ackStatus('f1')).toBeUndefined(); // unclaimed, and above all not 'completed'
    expect(getPendingMessages().map((m) => m.id)).toEqual(['f1']);

    goPastGrace();
    await waitFor(returned, 'processQuery to return');
    await run;
    // Still pending for the outer loop's next, fresh query.
    expect(getPendingMessages().map((m) => m.id)).toEqual(['f1']);
  });

  it('abandons a stream that stays silent past the grace window, so processQuery returns', async () => {
    const { state, run, returned } = await startStuck();
    goIdle();
    await waitFor(() => state.endCalls > 0, 'the idle end');
    await sleep(POLL_MS * 20);
    // Inside the grace window the provider may still drain and close on its own.
    expect(returned()).toBe(false);
    expect(state.abortCalls).toBe(0);
    expect(state.killCalls).toBe(0);

    goPastGrace();
    await waitFor(returned, 'processQuery to return');
    const result = await run;
    expect(state.abortCalls).toBe(1);
    expect(state.killCalls).toBe(1); // hard teardown of the process behind the dead stream
    expect(state.endCalls).toBe(1);
    expect(result.continuation).toBe('sess-stuck');
  });

  it('does not abort or kill a provider that closes its stream on end()', async () => {
    let endCalls = 0;
    let abortCalls = 0;
    let killCalls = 0;
    let close: (() => void) | undefined;
    let parked = false;
    async function* events(): AsyncGenerator<ProviderEvent> {
      yield { type: 'init', continuation: 'sess-ok' };
      yield { type: 'result', text: '' };
      parked = true;
      await new Promise<void>((resolve) => (close = resolve));
    }
    const query: AgentQuery = {
      events: events(),
      push: () => {},
      end: () => {
        endCalls += 1;
        close?.();
      },
      abort: () => {
        abortCalls += 1;
      },
      kill: () => {
        killCalls += 1;
      },
    };
    const run = processQuery(
      query,
      TASK_ROUTING,
      ['m1'],
      'claude',
      undefined,
      'prompt',
      undefined,
      true,
      undefined,
      POLL_MS,
    );
    await waitFor(() => parked, 'the first turn to complete');
    goIdle();
    await run;
    expect(endCalls).toBe(1);
    expect(abortCalls).toBe(0);
    expect(killCalls).toBe(0);
  });
});

describe('runPollLoop: the next message after a stuck idle-end runs in a fresh query', () => {
  it('answers the follow-up from a new provider query instead of losing it', async () => {
    insertMessage('m1', 'hello');
    const first = stuckQuery('answer one');
    const prompts: string[] = [];
    const controller = new AbortController();
    const provider: AgentProvider = {
      registerMemorySessionHook: () => false,
      isSessionInvalid: () => false,
      query: (input) => {
        prompts.push(input.prompt);
        if (prompts.length === 1) return first.query;
        async function* events(): AsyncGenerator<ProviderEvent> {
          yield { type: 'init', continuation: 'sess-fresh' };
          yield { type: 'text', text: '<message to="main">answer two</message>' };
          yield { type: 'result', text: '' };
        }
        return { events: events(), push: () => {}, end: () => {}, abort: () => {} };
      },
    };
    const loop = runPollLoop({
      provider,
      providerContract: CONTRACT,
      providerName: 'mock',
      cwd: '/workspace/agent',
      signal: controller.signal,
      activePollIntervalMs: POLL_MS,
    });
    const delivered = () => getUndeliveredMessages().map((row) => JSON.parse(row.content).text as string);
    try {
      await waitFor(() => first.state.parked, 'the first turn to complete');
      goIdle();
      await waitFor(() => first.state.endCalls > 0, 'the idle end');

      insertMessage('f1', 'are you there?');
      await sleep(POLL_MS * 20);
      goPastGrace();

      await waitFor(() => delivered().includes('answer two'), 'the follow-up to be answered', 8_000);
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).toContain('are you there?');
      expect(first.state.dropped).toEqual([]);
      expect(delivered()).toEqual(['answer one', 'answer two']);
      await waitFor(() => ackStatus('f1') === 'completed', 'the follow-up to be acked');
    } finally {
      controller.abort();
    }
    await loop;
  }, 15_000);
});
