#!/usr/bin/env bun
/**
 * Test double for `codex app-server --listen stdio://`, just enough of the JSON-RPC
 * protocol for codex-mcp-bridge.test.ts: initialize, thread/start, thread/resume,
 * turn/start (emits agentMessage deltas, an agentMessage item and turn/completed),
 * plus `--help` / `--version` so the runner's probe and the image tripwire have
 * something to read. Turn and item notifications carry `threadId` and `turnId`,
 * as codex 0.160's protocol requires. Behaviour knobs via env:
 *   FAKE_CODEX_REPLY      text of the agent message (default "VERDICT: approve")
 *   FAKE_CODEX_FAIL_TURN  when set, the turn fails with this message
 *   FAKE_CODEX_LOG        append every received line to this file (assertions)
 * and via the turn's input text:
 *   SPAWN_SUBAGENT        before the parent's answer, a sub-agent thread runs a
 *                         whole turn (message + turn/completed) on this server,
 *                         as codex's `spawn_agent` does
 *   SLOW_TURN             the turn streams reasoning for about a second before
 *                         it answers
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

async function runTurn(threadId: string, params: Record<string, unknown>): Promise<void> {
  const fail = process.env.FAKE_CODEX_FAIL_TURN;
  if (fail) {
    send({ method: 'turn/failed', params: { threadId, error: { message: fail } } });
    return;
  }
  const input = (params.input as Array<{ text?: string }> | undefined)?.[0]?.text ?? '';
  const reply = (process.env.FAKE_CODEX_REPLY ?? 'VERDICT: approve') + (input.includes('ROUND: 2') ? ' (round 2)' : '');
  if (input.includes('SPAWN_SUBAGENT')) {
    const child = `${threadId}-subagent`;
    send({ method: 'thread/started', params: { thread: { id: child, parentThreadId: threadId } } });
    answer(child, `${child}-t1`, 'Recall complete. Four relevant items found.');
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
