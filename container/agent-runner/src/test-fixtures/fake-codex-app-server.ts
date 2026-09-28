#!/usr/bin/env bun
/**
 * Test double for `codex app-server --listen stdio://`, just enough of the JSON-RPC
 * protocol for codex-mcp-bridge.test.ts: initialize, thread/start, thread/resume,
 * turn/start (emits agentMessage deltas, an agentMessage item and turn/completed),
 * plus `--help` / `--version` so the runner's probe and the image tripwire have
 * something to read. Behaviour knobs via env:
 *   FAKE_CODEX_REPLY      text of the agent message (default "VERDICT: approve")
 *   FAKE_CODEX_FAIL_TURN  when set, the turn fails with this message
 *   FAKE_CODEX_LOG        append every received line to this file (assertions)
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
      const fail = process.env.FAKE_CODEX_FAIL_TURN;
      if (fail) {
        send({ method: 'turn/failed', params: { error: { message: fail } } });
        break;
      }
      const input = (params.input as Array<{ text?: string }> | undefined)?.[0]?.text ?? '';
      const reply =
        (process.env.FAKE_CODEX_REPLY ?? 'VERDICT: approve') + (input.includes('ROUND: 2') ? ' (round 2)' : '');
      send({ method: 'item/started', params: { item: { type: 'agentMessage', id: 'i1' } } });
      send({ method: 'item/agentMessage/delta', params: { delta: reply.slice(0, 8) } });
      send({ method: 'item/agentMessage/delta', params: { delta: reply.slice(8) } });
      send({ method: 'item/completed', params: { item: { type: 'agentMessage', id: 'i1', text: reply } } });
      send({ method: 'turn/completed', params: { turn: { id: 't1' } } });
      break;
    }
    default:
      if (id !== undefined) send({ id, result: {} });
  }
});
rl.on('close', () => process.exit(0));
