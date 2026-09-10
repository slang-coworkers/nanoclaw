import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Background-subagent lifecycle must reach the poll loop: task_started as a
// counted progress event, task_progress/task_updated as activity (idle timer +
// heartbeat), task_notification as the finished marker. Prod 2026-09-09: the
// 20-min idle-end ended a wiki fold under four live subagents because none of
// these SDK messages produced an event.

const sdkMessages: unknown[] = [];

mock.module('@anthropic-ai/claude-agent-sdk', () => ({
  query: () =>
    (async function* () {
      for (const m of sdkMessages) yield m;
    })(),
}));

await import('./index.js');
await import('../provider-contracts/index.js');
const { createProvider } = await import('./factory.js');
const { MEMORY_SESSION_HOOK } = await import('../memory/session-hook.js');

let tmp: string;
let prevHome: string | undefined;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-task-events-'));
  prevHome = process.env.HOME;
  process.env.HOME = tmp;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME;
  else process.env.HOME = prevHome;
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('background task lifecycle translation', () => {
  it('task_started -> progress(task=started); task_progress/updated -> activity; task_notification -> progress(task=finished)', async () => {
    sdkMessages.length = 0;
    sdkMessages.push(
      { type: 'system', subtype: 'init', session_id: 'sess-1' },
      { type: 'system', subtype: 'task_started', task_id: 't1', description: 'SVD consolidate SA1 (parts 1,2,3)' },
      { type: 'system', subtype: 'task_progress', task_id: 't1', summary: 'reading part 1' },
      { type: 'system', subtype: 'task_updated', task_id: 't1' },
      { type: 'system', subtype: 'task_notification', task_id: 't1', status: 'completed', summary: 'SA1 done' },
      { type: 'result', subtype: 'success', result: '<message to="user">done</message>' },
    );

    const provider = createProvider('claude');
    provider.registerMemorySessionHook(MEMORY_SESSION_HOOK);
    const q = provider.query({ prompt: 'hi', cwd: tmp });

    const events: Array<{ type: string; message?: string; task?: string }> = [];
    for await (const e of q.events) events.push(e as { type: string; message?: string; task?: string });

    const progress = events.filter((e) => e.type === 'progress');
    expect(progress.map((e) => e.task)).toEqual(['started', 'finished']);
    expect(progress[0]!.message).toContain('SVD consolidate SA1');
    expect(progress[1]!.message).toBe('SA1 done');
    expect(events.filter((e) => e.type === 'activity').length).toBeGreaterThanOrEqual(2);
    expect(events.filter((e) => e.type === 'result')).toHaveLength(1);
  });
});
