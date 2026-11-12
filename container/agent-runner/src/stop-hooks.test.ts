import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { createStopHookRunner } from './stop-hooks.js';

// Fork-owned. Only the Claude Agent SDK runs the settings.json Stop hooks
// itself; for every other provider the runner runs them at each turn result.

const HOOK_URL = 'http://host.docker.internal:3838/api/hook-event';
let dir: string;
let settingsFile: string;
let env: NodeJS.ProcessEnv;

function settings(stop: Array<{ command: string }>): void {
  fs.writeFileSync(
    settingsFile,
    JSON.stringify({
      hooks: {
        Stop: stop.map((h) => ({ hooks: [h] })),
        StopFailure: [{ hooks: [{ command: `cat > ${path.join(dir, 'failure.json')}` }] }],
      },
    }),
  );
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stop-hooks-'));
  settingsFile = path.join(dir, 'settings.json');
  env = { ...process.env, NANOCLAW_HOOK_SETTINGS: settingsFile, NANOCLAW_HOOK_URL: HOOK_URL };
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('createStopHookRunner', () => {
  it('is null for a provider whose harness runs the Stop hooks (Claude)', () => {
    expect(createStopHookRunner({ runsSettingsStopHooks: true }, env)).toBeNull();
  });

  it("runs the group's Stop hooks with the session and stop_hook_active, and returns a block", async () => {
    const seen = path.join(dir, 'seen.json');
    settings([
      { command: `cat > ${seen}` },
      {
        command: `jq -e '.stop_hook_active' >/dev/null && exit 0; echo '{"decision":"block","reason":"stale explanation"}'`,
      },
    ]);
    const run = createStopHookRunner({}, env)!;
    const first = await run({ sessionId: 'ses_1', stopHookActive: false, lastAssistantMessage: 'done', failed: false });
    expect(first).toEqual({ block: true, reason: 'stale explanation' });
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8'))).toMatchObject({
      hook_event_name: 'Stop',
      session_id: 'ses_1',
      stop_hook_active: false,
      last_assistant_message: 'done',
    });
    // The continuation's stop goes through: the gate honours stop_hook_active.
    expect(
      (await run({ sessionId: 'ses_1', stopHookActive: true, lastAssistantMessage: null, failed: false })).block,
    ).toBe(false);
  });

  it('runs StopFailure for a failed turn and never blocks it', async () => {
    settings([{ command: `echo '{"decision":"block","reason":"x"}'` }]);
    const run = createStopHookRunner({}, env)!;
    expect(await run({ sessionId: 's', stopHookActive: false, lastAssistantMessage: null, failed: true })).toEqual({
      block: false,
      reason: '',
    });
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'failure.json'), 'utf-8')).hook_event_name).toBe('StopFailure');
  });

  it('skips the telemetry hook for a provider that reports its own events (Codex), and keeps the gates', async () => {
    const telemetry = path.join(dir, 'telemetry');
    const gate = path.join(dir, 'gate');
    settings([{ command: `touch ${telemetry} # curl -X POST ${HOOK_URL}` }, { command: `touch ${gate}` }]);
    await createStopHookRunner({ reportsHookTelemetry: true }, env)!({
      sessionId: 's',
      stopHookActive: false,
      lastAssistantMessage: null,
      failed: false,
    });
    expect(fs.existsSync(telemetry)).toBe(false);
    expect(fs.existsSync(gate)).toBe(true);
    await createStopHookRunner({}, env)!({
      sessionId: 's',
      stopHookActive: false,
      lastAssistantMessage: null,
      failed: false,
    });
    expect(fs.existsSync(telemetry)).toBe(true);
  });
});
