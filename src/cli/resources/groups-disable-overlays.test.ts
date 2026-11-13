import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../container-runner.js', () => ({
  wakeContainer: vi.fn().mockResolvedValue(undefined),
  isContainerRunning: vi.fn().mockReturnValue(false),
  getActiveContainerCount: vi.fn().mockReturnValue(0),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../config.js', async () => {
  const actual = await vi.importActual('../../config.js');
  return { ...actual, DATA_DIR: '/tmp/nanoclaw-test-cli-disable-overlays' };
});

const TEST_DIR = '/tmp/nanoclaw-test-cli-disable-overlays';

import { closeDb, createAgentGroup, initTestDb, runMigrations } from '../../db/index.js';
import { dispatch } from '../dispatch.js';
import './groups.js';

// The overlay kill switch (agent_groups.disable_overlays) overrides the overlays
// an operator selects; `ncl groups get` shows it and `ncl groups update` sets it.

const call = (command: string, args: Record<string, unknown>) =>
  dispatch({ id: `c-${Math.random()}`, command, args }, { caller: 'host' });

beforeEach(async () => {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  await createAgentGroup({
    id: 'ag-1',
    name: 'g',
    folder: 'g',
    agent_provider: null,
    created_at: new Date().toISOString(),
  });
});
afterEach(() => {
  closeDb();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe('groups disable_overlays', () => {
  it('shows the switch and turns it on and off', async () => {
    const before = await call('groups-get', { id: 'ag-1' });
    expect(before.ok && (before.data as Record<string, unknown>).disable_overlays).toBe(0);
    expect((await call('groups-update', { id: 'ag-1', disable_overlays: 1 })).ok).toBe(true);
    const on = await call('groups-get', { id: 'ag-1' });
    expect(on.ok && (on.data as Record<string, unknown>).disable_overlays).toBe(1);
    expect((await call('groups-update', { id: 'ag-1', disable_overlays: 0 })).ok).toBe(true);
  });

  it('accepts only 0 and 1', async () => {
    const res = await call('groups-update', { id: 'ag-1', disable_overlays: 2 });
    expect(res.ok).toBe(false);
  });
});
