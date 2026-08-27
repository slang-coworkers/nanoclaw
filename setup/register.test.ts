import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/group-init.js', () => ({
  initGroupFilesystem: vi.fn(),
}));

vi.mock('../src/session-manager.js', () => ({
  resolveSession: vi.fn(() => ({ session: { id: 'test-session' } })),
  writeSessionMessage: vi.fn(),
}));

vi.mock('../src/log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./status.js', () => ({
  emitStatus: vi.fn(),
}));

import {
  closeDb,
  getAgentGroupByFolder,
  getMessagingGroupByPlatform,
  getMessagingGroupAgentByPair,
} from '../src/db/index.js';
import { getDestinationByTarget } from '../src/modules/agent-to-agent/db/agent-destinations.js';
import { run } from './register.js';

const realCwd = process.cwd();
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'register-test-'));
  fs.mkdirSync(path.join(tempDir, 'groups'), { recursive: true });
  process.chdir(tempDir);
});

afterEach(async () => {
  await closeDb();
  process.chdir(realCwd);
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('setup/register', () => {
  it('writes the central DB under the CALL-TIME cwd, not the load-time one', async () => {
    // Names the invariant the tests below only catch as collateral damage.
    //
    // `register.ts` used to open `CENTRAL_DB_PATH`, a constant src/config.ts
    // resolves from `process.cwd()` at MODULE LOAD — so once vitest imported
    // config.js from the repo root, every `run()` in this file wrote to the
    // REPO's data/v2.db regardless of the chdir above. That corrupted a real
    // install's central DB on any `pnpm test`, and the tests below then failed
    // on state leaked between them rather than on anything they assert.
    //
    // Asserted via mtime rather than existence: a dev checkout legitimately has
    // a data/v2.db (a real install lives there), so `not.toExist` would pass in
    // CI and fail locally for the wrong reason.
    const liveDb = path.join(realCwd, 'data', 'v2.db');
    const before = fs.existsSync(liveDb) ? fs.statSync(liveDb).mtimeMs : null;

    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);

    expect(fs.existsSync(path.join(tempDir, 'data', 'v2.db'))).toBe(true);
    const after = fs.existsSync(liveDb) ? fs.statSync(liveDb).mtimeMs : null;
    expect(after).toBe(before);
  });

  it('defaults admin coworker_type to main', async () => {
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    const agent = await getAgentGroupByFolder('main');
    expect(agent).toBeDefined();
    expect(agent!.is_admin).toBe(1);
    expect(agent!.coworker_type).toBe('main');
  });

  it('creates bidirectional admin destinations for a non-admin coworker', async () => {
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    await run([
      '--platform-id', 'discord-chan-1',
      '--name', 'Slang Fixer',
      '--folder', 'slang-fixer',
      '--channel', 'discord',
    ]);

    const admin = (await getAgentGroupByFolder('main'))!;
    const child = (await getAgentGroupByFolder('slang-fixer'))!;
    expect(admin).toBeDefined();
    expect(child).toBeDefined();

    expect(await getDestinationByTarget(admin.id, 'agent', child.id)).toBeDefined();
    expect(await getDestinationByTarget(child.id, 'agent', admin.id)).toBeDefined();
  });

  it('routing=internal skips messaging group creation and wiring', async () => {
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    await run([
      '--platform-id', 'discord-chan-2',
      '--name', 'Internal Worker',
      '--folder', 'internal-worker',
      '--channel', 'discord',
      '--routing', 'internal',
    ]);

    const child = (await getAgentGroupByFolder('internal-worker'))!;
    expect(child).toBeDefined();
    expect(child.routing).toBe('internal');

    expect(await getMessagingGroupByPlatform('discord', 'discord:discord-chan-2')).toBeUndefined();

    const admin = (await getAgentGroupByFolder('main'))!;
    expect(await getDestinationByTarget(admin.id, 'agent', child.id)).toBeDefined();
    expect(await getDestinationByTarget(child.id, 'agent', admin.id)).toBeDefined();
  });

  it('defaults dashboard channel session_mode to per-thread', async () => {
    // The Slack-style thread UI requires per-thread sessions; without
    // this default, replies land in the root session keyed on
    // thread_id=NULL and the thread panel shows "no replies yet" even
    // though the agent processed the message. See PR #155 for context.
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    const mg = (await getMessagingGroupByPlatform('dashboard', 'dashboard:dashboard_main'))!;
    const agent = (await getAgentGroupByFolder('main'))!;
    const mga = (await getMessagingGroupAgentByPair(mg.id, agent.id))!;
    expect(mga.session_mode).toBe('per-thread');
  });

  it('keeps non-dashboard channels on the conservative shared default', async () => {
    // Telegram/WhatsApp/iMessage/Discord/Slack don't need per-thread
    // isolation for the dashboard UI; shared preserves existing behaviour.
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    await run([
      '--platform-id', 'discord-chan-sm',
      '--name', 'Discord Worker',
      '--folder', 'discord-worker',
      '--channel', 'discord',
    ]);
    const mg = (await getMessagingGroupByPlatform('discord', 'discord:discord-chan-sm'))!;
    const agent = (await getAgentGroupByFolder('discord-worker'))!;
    const mga = (await getMessagingGroupAgentByPair(mg.id, agent.id))!;
    expect(mga.session_mode).toBe('shared');
  });

  it('--session-mode explicitly passed wins over the channel-aware default', async () => {
    // Escape hatch: an operator can force any session mode regardless of
    // channel. Verified for both directions (dashboard → shared, non-dashboard → per-thread).
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
      '--session-mode', 'shared',
    ]);
    const dashMg = (await getMessagingGroupByPlatform('dashboard', 'dashboard:dashboard_main'))!;
    const dashAgent = (await getAgentGroupByFolder('main'))!;
    const dashMga = (await getMessagingGroupAgentByPair(dashMg.id, dashAgent.id))!;
    expect(dashMga.session_mode).toBe('shared');

    await run([
      '--platform-id', 'discord-chan-explicit',
      '--name', 'Discord Explicit',
      '--folder', 'discord-explicit',
      '--channel', 'discord',
      '--session-mode', 'per-thread',
    ]);
    const dMg = (await getMessagingGroupByPlatform('discord', 'discord:discord-chan-explicit'))!;
    const dAgent = (await getAgentGroupByFolder('discord-explicit'))!;
    const dMga = (await getMessagingGroupAgentByPair(dMg.id, dAgent.id))!;
    expect(dMga.session_mode).toBe('per-thread');
  });

  it('routing=direct creates messaging group and wiring', async () => {
    await run([
      '--platform-id', 'dashboard_main',
      '--name', 'Dashboard Main',
      '--folder', 'main',
      '--channel', 'dashboard',
      '--is-admin',
    ]);
    await run([
      '--platform-id', 'discord-chan-3',
      '--name', 'Direct Worker',
      '--folder', 'direct-worker',
      '--channel', 'discord',
    ]);

    const child = (await getAgentGroupByFolder('direct-worker'))!;
    const mg = await getMessagingGroupByPlatform('discord', 'discord:discord-chan-3');
    expect(child.routing).toBe('direct');
    expect(mg).toBeDefined();
    expect(await getMessagingGroupAgentByPair(mg!.id, child.id)).toBeDefined();
  });
});
