import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CodexProvider } from './codex.js';
import type { ProviderEvent } from './types.js';

// The Codex provider's turn loop, run against the fake `codex app-server`
// (test-fixtures/fake-codex-app-server.ts), which sends the notification shapes
// codex 0.160 sends. Each prompt marker picks one way a turn ends.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const FAKE = path.join(HERE, '..', 'test-fixtures', 'fake-codex-app-server.ts');

let home: string;
const saved = { PATH: process.env.PATH, HOME: process.env.HOME };

beforeAll(() => {
  home = mkdtempSync(path.join(tmpdir(), 'codex-provider-turn-'));
  const shim = path.join(home, 'codex');
  writeFileSync(shim, `#!/bin/sh\nexec bun run ${FAKE} "$@"\n`);
  chmodSync(shim, 0o755);
  process.env.PATH = `${home}:${saved.PATH ?? ''}`;
  process.env.HOME = home;
});

afterAll(() => {
  process.env.PATH = saved.PATH;
  process.env.HOME = saved.HOME;
  rmSync(home, { recursive: true, force: true });
});

/** Run one prompt through the provider and return the turn's `result` event. */
async function resultOf(prompt: string): Promise<Extract<ProviderEvent, { type: 'result' }>> {
  const q = new CodexProvider({ env: { CODEX_MODEL: 'fake-model' } }).query({ prompt, cwd: home });
  try {
    for await (const ev of q.events) {
      if (ev.type === 'result') return ev;
    }
    throw new Error('the provider ended without a result');
  } finally {
    q.end();
  }
}

describe('CodexProvider turn end', () => {
  it('reports a failed turn (turn/completed, status "failed") as an error result with codex error', async () => {
    const r = await resultOf('TURN_FAILS');
    expect(r.isError).toBe(true);
    expect(r.error).toContain('fake model rejected the request');
  });

  it('reports an interrupted turn as an error result', async () => {
    const r = await resultOf('TURN_INTERRUPTED');
    expect(r.isError).toBe(true);
    expect(r.error).toContain('interrupted');
  });

  it('still reports a turn/failed from codex before 0.160 as an error result', async () => {
    const r = await resultOf('LEGACY_TURN_FAILED');
    expect(r.isError).toBe(true);
    expect(r.error).toContain('fake model rejected the request');
  });

  it("returns the turn's own answer when the turn spawns a sub-agent", async () => {
    const r = await resultOf('SPAWN_SUBAGENT');
    expect(r.isError).toBeFalsy();
    expect(r.text).toBe('VERDICT: approve');
  });
});
