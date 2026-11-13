import type { ChildProcess } from 'child_process';
import { describe, expect, it } from 'bun:test';

import { runOneTurn } from './pi.js';
import type { PiEvent, PiRpcServer } from './pi-rpc.js';
import type { ProviderEvent } from './types.js';

/**
 * A pi process stand-in: it accepts the prompt command, then plays `script`
 * through the event handlers, as the real process streams its events.
 */
function fakeServer(script: PiEvent[]): PiRpcServer {
  const server: PiRpcServer = {
    process: {
      stdin: {
        write: (line: string, cb?: (err?: Error | null) => void) => {
          const { id } = JSON.parse(line) as { id: string };
          queueMicrotask(() => {
            server.pending.get(id)?.resolve({ type: 'response', id, success: true });
            server.pending.delete(id);
            for (const event of script) for (const handler of [...server.eventHandlers]) handler(event);
          });
          cb?.(null);
          return true;
        },
      },
    } as unknown as ChildProcess,
    pending: new Map(),
    eventHandlers: [],
    terminalHandlers: [],
    terminalError: null,
  };
  return server;
}

const assistant = (model: string, usage: Record<string, number>, extra: Record<string, unknown> = {}): PiEvent => ({
  type: 'message_end',
  message: { role: 'assistant', model, usage, content: [{ type: 'text', text: 'done' }], ...extra },
});

async function turnEvents(script: PiEvent[], model?: string): Promise<ProviderEvent[]> {
  const out: ProviderEvent[] = [];
  for await (const event of runOneTurn(fakeServer(script), 'hi', model)) if (event.type !== 'activity') out.push(event);
  return out;
}

describe('pi turn accounting', () => {
  it('sums the assistant calls of a turn by model and sends them with the result and a usage event', async () => {
    const events = await turnEvents([
      assistant('nvidia/zai-org/glm-5.3', { input: 800, output: 50, reasoning: 40, cacheRead: 30_000, cacheWrite: 0 }),
      { type: 'message_end', message: { role: 'toolResult', content: [] } },
      assistant('nvidia/zai-org/glm-5.3', { input: 100, output: 10, cacheRead: 31_000, cacheWrite: 20 }),
      { type: 'agent_settled' },
    ]);
    const rows = [
      {
        model: 'nvidia/zai-org/glm-5.3',
        inputTokens: 900,
        outputTokens: 60,
        reasoningTokens: 40,
        cacheReadTokens: 61_000,
        cacheWriteTokens: 20,
      },
    ];
    const result = events.find((e) => e.type === 'result') as Extract<ProviderEvent, { type: 'result' }>;
    expect(result.accounting?.turnTokens).toEqual(rows);
    const usage = events.find((e) => e.type === 'usage') as Extract<ProviderEvent, { type: 'usage' }>;
    expect(usage.turnTokens).toEqual(rows);
    expect(usage.inputTokens).toBe(900);
    expect(events.map((e) => e.type)).toEqual(['result', 'usage']);
  });

  it('charges the calls of a failed turn before the error ends it', async () => {
    const events = await turnEvents([
      assistant('nvidia/zai-org/glm-5.3', { input: 500, output: 5, cacheRead: 0, cacheWrite: 0 }),
      assistant(
        'nvidia/zai-org/glm-5.3',
        { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        {
          stopReason: 'error',
          errorMessage: 'rate limited',
        },
      ),
      { type: 'agent_settled' },
    ]);
    expect(events.map((e) => e.type)).toEqual(['usage', 'error']);
    const usage = events[0] as Extract<ProviderEvent, { type: 'usage' }>;
    expect(usage.isError).toBe(true);
    expect(usage.turnTokens?.[0]).toMatchObject({ model: 'nvidia/zai-org/glm-5.3', inputTokens: 500, outputTokens: 5 });
  });

  it('sends an empty report for a turn with no calls, so the hard stop still runs', async () => {
    const events = await turnEvents([{ type: 'agent_settled' }]);
    const usage = events.find((e) => e.type === 'usage') as Extract<ProviderEvent, { type: 'usage' }>;
    expect(usage.turnTokens).toEqual([]);
  });

  it('charges a compaction call as the configured model', async () => {
    const events = await turnEvents(
      [
        {
          type: 'compaction_end',
          result: { summary: 's', usage: { input: 40_000, output: 900, cacheRead: 0, cacheWrite: 0 } },
        },
        { type: 'agent_settled' },
      ],
      'nvidia/zai-org/glm-5.3',
    );
    const usage = events.find((e) => e.type === 'usage') as Extract<ProviderEvent, { type: 'usage' }>;
    expect(usage.turnTokens).toEqual([
      {
        model: 'nvidia/zai-org/glm-5.3',
        inputTokens: 40_000,
        outputTokens: 900,
        reasoningTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ]);
  });
});
