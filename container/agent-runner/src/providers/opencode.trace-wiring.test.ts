import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initTestSessionDb, closeSessionDb } from '../mailbox/sqlite/connection.js';
import { registerAgentMailbox, resetAgentMailboxForTesting } from '../mailbox/index.js';
import { SqliteAgentMailbox } from '../mailbox/sqlite/index.js';
import { destroySharedRuntime, OpenCodeProvider, setSharedRuntimeDepsForTesting } from './opencode.js';
import { stopOpenCodeTraceProxies } from './opencode-trace.js';

/**
 * The shared server is spawned with the recording proxy as its provider
 * `baseURL` when tracing is on, and with the original address when it is off.
 * A spawn that fails right away is enough to read the config it was given.
 */
const UPSTREAM = 'http://127.0.0.1:9/llm/v1';
const saved: Record<string, string | undefined> = {};
const KEYS = ['OPENCODE_PROVIDER', 'OPENCODE_BASE_URL', 'NANOCLAW_OPENCODE_TRACE', 'NANOCLAW_OPENCODE_TRACE_DIR'];
let dir: string;
let previousMailbox: ReturnType<typeof resetAgentMailboxForTesting>;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'oc-wire-'));
  for (const key of KEYS) saved[key] = process.env[key];
  process.env.OPENCODE_PROVIDER = 'openai';
  process.env.OPENCODE_BASE_URL = UPSTREAM;
  process.env.NANOCLAW_OPENCODE_TRACE_DIR = dir;
  previousMailbox = resetAgentMailboxForTesting();
  initTestSessionDb();
  registerAgentMailbox(() => new SqliteAgentMailbox());
});
afterEach(() => {
  destroySharedRuntime();
  stopOpenCodeTraceProxies();
  setSharedRuntimeDepsForTesting();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetAgentMailboxForTesting();
  closeSessionDb();
  if (previousMailbox) registerAgentMailbox(previousMailbox);
  rmSync(dir, { recursive: true, force: true });
});

async function spawnedBaseUrl(): Promise<string | undefined> {
  let seen: Record<string, unknown> | undefined;
  setSharedRuntimeDepsForTesting({
    spawnServer: mock(async (config: Record<string, unknown>) => {
      seen = config;
      throw new Error('stop after spawn');
    }),
    createClient: () => {
      throw new Error('unused');
    },
    createQuestionClient: () => {
      throw new Error('unused');
    },
  });
  const provider = new OpenCodeProvider({});
  // No hook sources, so no subprocess starts.
  provider.registerMemorySessionHook({ command: 'true', legacyCommands: [], sources: [] });
  const query = provider.query({ prompt: 'x', cwd: '/tmp/opencode-trace-wiring' });
  query.end();
  const timer = setTimeout(() => query.abort(), 2000);
  try {
    for await (const _ of query.events) void _;
  } catch {
    /* the fake spawn fails on purpose */
  } finally {
    clearTimeout(timer);
  }
  const providers = seen?.provider as Record<string, { options: { baseURL?: string } }> | undefined;
  return providers?.openai?.options?.baseURL;
}

describe('OpenCode tracing is wired into the server spawn', () => {
  it('uses the recording proxy when on', async () => {
    const base = await spawnedBaseUrl();
    expect(base).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/llm\/v1$/);
    expect(base).not.toBe(UPSTREAM);
  });
  it('keeps the original address when off', async () => {
    process.env.NANOCLAW_OPENCODE_TRACE = 'off';
    expect(await spawnedBaseUrl()).toBe(UPSTREAM);
  });
});
