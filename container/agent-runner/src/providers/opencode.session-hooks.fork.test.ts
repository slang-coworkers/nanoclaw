import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { closeSessionDb, initTestSessionDb } from '../mailbox/sqlite/connection.js';
import { OpenCodeProvider, type OpenCodeRuntimeHandle } from './opencode.js';
import type { OpenCodeSessionHooks } from './opencode-hook-bridge.js';
import type { ProviderEvent } from './types.js';

// Fork-owned. Claude Code runs SessionStart when its CLI starts a query and
// SessionEnd when the query ends. The OpenCode provider runs the same hooks
// around each query, because no OpenCode event marks those points.

let dir: string;
let savedXdg: string | undefined;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-session-hooks-'));
  savedXdg = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = dir;
  // Each turn renders the delivery rules from the session's destinations.
  initTestSessionDb();
});
afterEach(() => {
  closeSessionDb();
  if (savedXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = savedXdg;
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A runtime whose server is connected and whose every prompt fails, recording the calls in `log`. */
function failingRuntime(log: string[]): OpenCodeRuntimeHandle {
  async function* stream() {
    yield { type: 'server.connected', properties: {} };
    await new Promise(() => {});
  }
  return {
    client: {
      session: {
        async create() {
          log.push('create');
          return { data: { id: 'ses_new' } };
        },
        async prompt(params) {
          log.push(`prompt ${params.path.id}`);
          return { error: { name: 'APIError', data: { message: 'backend down' } } };
        },
        async messages() {
          return { data: [] };
        },
        async abort() {
          return {};
        },
      },
    },
    stream: stream(),
    questionClient: {
      question: {
        async reply() {
          return { data: true };
        },
        async list() {
          return { data: [] };
        },
      },
    },
  };
}

function recordingHooks(log: string[]): OpenCodeSessionHooks {
  return {
    async start(sessionId, source) {
      log.push(`SessionStart ${sessionId} ${source}`);
    },
    async end(sessionId) {
      log.push(`SessionEnd ${sessionId}`);
    },
  };
}

async function runQuery(provider: OpenCodeProvider, continuation?: string): Promise<ProviderEvent[]> {
  provider.registerMemorySessionHook({ command: 'true', legacyCommands: [], sources: [] });
  const query = provider.query({ prompt: 'hi', cwd: dir, continuation });
  query.end();
  const events: ProviderEvent[] = [];
  try {
    for await (const event of query.events) events.push(event);
  } catch {
    // The failing prompt ends the query with an error; the hooks still ran.
  }
  return events;
}

describe('OpenCode query session hooks', () => {
  it('starts a session it creates as startup before the prompt and ends it with the query', async () => {
    const log: string[] = [];
    const runtime = failingRuntime(log);
    const provider = new OpenCodeProvider({}, { getRuntime: async () => runtime }, undefined, recordingHooks(log));
    await runQuery(provider);
    expect(log).toEqual(['create', 'SessionStart ses_new startup', 'prompt ses_new', 'SessionEnd ses_new']);
  });

  it('starts a stored continuation as resume', async () => {
    const log: string[] = [];
    const runtime = failingRuntime(log);
    const provider = new OpenCodeProvider({}, { getRuntime: async () => runtime }, undefined, recordingHooks(log));
    await runQuery(provider, 'ses_old');
    expect(log).toEqual(['SessionStart ses_old resume', 'prompt ses_old', 'SessionEnd ses_old']);
  });

  it('runs no session hooks for a query aborted before it reached a session', async () => {
    const log: string[] = [];
    const provider = new OpenCodeProvider(
      {},
      { getRuntime: () => new Promise<OpenCodeRuntimeHandle>(() => {}) },
      undefined,
      recordingHooks(log),
    );
    provider.registerMemorySessionHook({ command: 'true', legacyCommands: [], sources: [] });
    const query = provider.query({ prompt: 'hi', cwd: dir });
    const first = query.events[Symbol.asyncIterator]().next();
    query.abort();
    await Promise.race([first, new Promise((resolve) => setTimeout(resolve, 50))]);
    expect(log).toEqual([]);
  });
});
