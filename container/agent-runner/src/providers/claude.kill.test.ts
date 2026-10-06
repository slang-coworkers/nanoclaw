import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// kill() is the poll loop's hard teardown for a stream that never closed: it
// must abort the SDK (which then terminates the CLI process). abort() keeps its
// old meaning — end the input, let the stream wind down — and must not.

let lastOptions: { abortController?: AbortController } | undefined;

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: (args: { options: { abortController?: AbortController } }) => {
    lastOptions = args.options;
    return (async function* () {
      yield { type: 'system', subtype: 'init', session_id: 'sess-1' };
    })();
  },
}));

await import('./index.js');
await import('../provider-contracts/index.js');
const { createProvider } = await import('./factory.js');
const { MEMORY_SESSION_HOOK } = await import('../memory/session-hook.js');

let tmp: string;
let prevHome: string | undefined;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-kill-'));
  prevHome = process.env.HOME;
  process.env.HOME = tmp;
  lastOptions = undefined;
});
afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(tmp, { recursive: true, force: true });
});

function startQuery() {
  const provider = createProvider('claude');
  provider.registerMemorySessionHook(MEMORY_SESSION_HOOK);
  return provider.query({ prompt: 'hi', cwd: tmp });
}

describe('claude query hard teardown', () => {
  it('hands the SDK an abort controller that is idle by default', () => {
    startQuery();
    expect(lastOptions?.abortController).toBeInstanceOf(AbortController);
    expect(lastOptions?.abortController?.signal.aborted).toBe(false);
  });

  it('abort() only ends the input and leaves the SDK process alone', () => {
    const query = startQuery();
    query.abort();
    expect(lastOptions?.abortController?.signal.aborted).toBe(false);
  });

  it('kill() aborts the SDK so it terminates the CLI process', () => {
    const query = startQuery();
    expect(query.kill).toBeFunction();
    query.kill?.();
    expect(lastOptions?.abortController?.signal.aborted).toBe(true);
  });
});
