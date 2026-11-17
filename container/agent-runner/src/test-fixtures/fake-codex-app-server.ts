#!/usr/bin/env bun
/**
 * Test double for `codex app-server --listen stdio://`, just enough of the JSON-RPC
 * protocol for codex-mcp-bridge.test.ts: initialize, thread/start, thread/resume,
 * turn/start (emits agentMessage deltas, an agentMessage item and turn/completed),
 * plus `--help` / `--version` so the runner's probe and the image tripwire have
 * something to read. Turn and item notifications carry `threadId` and `turnId`,
 * as codex 0.160's protocol requires. Behaviour knobs via env:
 *   FAKE_CODEX_REPLY      text of the agent message (default "VERDICT: approve")
 *   FAKE_CODEX_LOG        append every received line to this file (assertions)
 * and via the turn's input text:
 *   SPAWN_SUBAGENT        a sub-agent thread runs a whole turn (message +
 *                         turn/completed) on this server, as codex's
 *                         `spawn_agent` does, and the parent answers 200 ms later
 *   SLOW_TURN             the turn streams reasoning for about a second before
 *                         it answers
 *   TURN_FAILS            the turn fails the way codex 0.160 reports it: a retry
 *                         `error`, the final `error` (willRetry false), then
 *                         `turn/completed` with status "failed" and turn.error
 *   TURN_INTERRUPTED      `turn/completed` with status "interrupted", error null
 *   LEGACY_TURN_FAILED    `turn/failed`, as codex versions before 0.160 sent
 */
import { appendFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const argv = process.argv.slice(2);
if (argv.includes('--version')) {
  console.log('codex-cli 9.9.9-fake');
  process.exit(0);
}
if (argv.includes('--help') || argv[0] === 'help') {
  console.log(
    'Codex CLI\n\nCommands:\n  exec        Run Codex non-interactively\n  app-server  [experimental] Run the app server or related tooling\n  mcp         Manage external MCP servers for Codex\n',
  );
  process.exit(0);
}
if (argv[0] !== 'app-server') {
  console.error(`fake codex: unsupported invocation ${argv.join(' ')}`);
  process.exit(2);
}

const logFile = process.env.FAKE_CODEX_LOG;
const send = (msg: unknown): void => {
  process.stdout.write(JSON.stringify(msg) + '\n');
};
let threadSeq = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Emit one whole agent-message turn on `threadId`: deltas, the completed item, turn/completed. */
function answer(threadId: string, turnId: string, text: string): void {
  send({ method: 'turn/started', params: { threadId, turn: { id: turnId, status: 'inProgress', items: [] } } });
  send({ method: 'item/started', params: { threadId, turnId, item: { type: 'agentMessage', id: `${turnId}-i1` } } });
  send({
    method: 'item/agentMessage/delta',
    params: { threadId, turnId, itemId: `${turnId}-i1`, delta: text.slice(0, 8) },
  });
  send({
    method: 'item/agentMessage/delta',
    params: { threadId, turnId, itemId: `${turnId}-i1`, delta: text.slice(8) },
  });
  send({
    method: 'item/completed',
    params: { threadId, turnId, item: { type: 'agentMessage', id: `${turnId}-i1`, text } },
  });
  send({ method: 'turn/completed', params: { threadId, turn: { id: turnId, status: 'completed', items: [] } } });
}

/** The model endpoint's error as codex 0.160 relays it (captured from a real failed turn). */
const FAKE_TURN_ERROR = '{"error": {"message": "fake model rejected the request", "type": "invalid_request_error"}}';

/** End `turnId` without an answer, in the shapes codex 0.160 sends (see the knobs above). */
function endTurnWithoutAnswer(threadId: string, turnId: string, input: string): boolean {
  const turn = (status: string, error: unknown) => ({ id: turnId, items: [], status, error });
  if (input.includes('LEGACY_TURN_FAILED')) {
    send({ method: 'turn/failed', params: { threadId, error: { message: FAKE_TURN_ERROR } } });
    return true;
  }
  if (input.includes('TURN_FAILS')) {
    const error = { message: FAKE_TURN_ERROR, codexErrorInfo: 'other', additionalDetails: null };
    send({ method: 'turn/started', params: { threadId, turn: turn('inProgress', null) } });
    send({ method: 'error', params: { error: { message: 'Reconnecting... 1/5' }, willRetry: true, threadId, turnId } });
    send({ method: 'error', params: { error, willRetry: false, threadId, turnId } });
    send({ method: 'turn/completed', params: { threadId, turn: turn('failed', error) } });
    return true;
  }
  if (input.includes('TURN_INTERRUPTED')) {
    send({ method: 'turn/started', params: { threadId, turn: turn('inProgress', null) } });
    send({ method: 'turn/completed', params: { threadId, turn: turn('interrupted', null) } });
    return true;
  }
  return false;
}

async function runTurn(threadId: string, params: Record<string, unknown>): Promise<void> {
  const input = (params.input as Array<{ text?: string }> | undefined)?.[0]?.text ?? '';
  if (endTurnWithoutAnswer(threadId, 't1', input)) return;
  const reply = (process.env.FAKE_CODEX_REPLY ?? 'VERDICT: approve') + (input.includes('ROUND: 2') ? ' (round 2)' : '');
  if (input.includes('SPAWN_SUBAGENT')) {
    const child = `${threadId}-subagent`;
    send({ method: 'thread/started', params: { thread: { id: child, parentThreadId: threadId } } });
    answer(child, `${child}-t1`, 'Recall complete. Four relevant items found.');
    // The parent answers later, as on prod (minutes after its sub-agent ended).
    await sleep(200);
  }
  if (input.includes('SLOW_TURN')) {
    for (let i = 0; i < 10; i += 1) {
      await sleep(100);
      send({
        method: 'item/reasoning/textDelta',
        params: { threadId, turnId: 't1', itemId: 'r1', contentIndex: 0, delta: '.' },
      });
    }
  }
  answer(threadId, 't1', reply);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  if (logFile) appendFileSync(logFile, line + '\n');
  let req: { id?: number; method?: string; params?: Record<string, unknown> };
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params = {} } = req;
  switch (method) {
    case 'initialize':
      send({ id, result: { userAgent: 'fake-codex' } });
      break;
    case 'thread/start': {
      const tid = `thread-${++threadSeq}`;
      send({ id, result: { thread: { id: tid } } });
      send({ method: 'thread/started', params: { thread: { id: tid } } });
      break;
    }
    case 'thread/resume': {
      const tid = String(params.threadId ?? '');
      if (tid.startsWith('stale-')) send({ id, error: { code: -1, message: `thread not found: ${tid}` } });
      else send({ id, result: { thread: { id: tid } } });
      break;
    }
    case 'turn/start': {
      send({ id, result: {} });
      void runTurn(String(params.threadId ?? ''), params);
      break;
    }
    default:
      if (id !== undefined) send({ id, result: {} });
  }
});
rl.on('close', () => process.exit(0));
