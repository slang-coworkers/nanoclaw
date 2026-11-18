/**
 * ensureContainerConfig provider stamping.
 *
 * Two load-bearing guarantees:
 *   1. A fresh row records the creator's explicit pick, Claude included, and a
 *      group created on Claude records weights=any. A row with no pick stays
 *      empty, so the group follows the install default (OpenCode, open).
 *   2. An existing row is never overwritten (INSERT OR IGNORE), so a later
 *      ensure or a changed install default never rewrites it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { initTestDb, closeDb } from './connection.js';
import { runMigrations } from './migrations/index.js';
import { createAgentGroup } from './agent-groups.js';
import { ensureContainerConfig, getContainerConfig, updateContainerConfigScalars } from './container-configs.js';

async function makeGroup(id: string, agentProvider: string | null = null): Promise<void> {
  await createAgentGroup({
    id,
    name: id,
    folder: id,
    agent_provider: agentProvider,
    created_at: new Date().toISOString(),
  });
}

describe('ensureContainerConfig provider stamping', () => {
  beforeEach(async () => {
    const db = await initTestDb();
    await runMigrations(db);
  });
  afterEach(async () => {
    await closeDb();
  });

  it('records an explicit pick on a fresh row, Claude included, with weights=any for Claude', async () => {
    const row = async (id: string) => {
      const r = await getContainerConfig(id);
      return { provider: r?.provider, weights: r?.weights };
    };
    await makeGroup('ag-codex');
    await ensureContainerConfig('ag-codex', 'codex');
    expect(await row('ag-codex')).toEqual({ provider: 'codex', weights: null });

    await makeGroup('ag-claude');
    await ensureContainerConfig('ag-claude', 'claude');
    expect(await row('ag-claude')).toEqual({ provider: 'claude', weights: 'any' });

    // Casing is normalized to match what resolution lowercases to.
    await makeGroup('ag-cased-claude');
    await ensureContainerConfig('ag-cased-claude', 'Claude');
    expect(await row('ag-cased-claude')).toEqual({ provider: 'claude', weights: 'any' });

    // No pick: the row stays empty and the group follows the install default.
    await makeGroup('ag-default');
    await ensureContainerConfig('ag-default');
    expect(await row('ag-default')).toEqual({ provider: null, weights: null });

    // The group's own provider outranks the row, so it decides the weights.
    await makeGroup('ag-group-claude', 'claude');
    await ensureContainerConfig('ag-group-claude', 'opencode');
    expect(await row('ag-group-claude')).toEqual({ provider: 'opencode', weights: 'any' });

    // Explicit weights win.
    await makeGroup('ag-open');
    await ensureContainerConfig('ag-open', 'opencode', 'open');
    expect(await row('ag-open')).toEqual({ provider: 'opencode', weights: 'open' });
  });

  it('never overwrites an existing row — existing groups are not flipped', async () => {
    await makeGroup('ag-existing');
    await ensureContainerConfig('ag-existing', 'codex'); // existing group already on codex
    expect((await getContainerConfig('ag-existing'))?.provider).toBe('codex');

    // A later bare ensure (defensive re-init, or a changed instance default)
    // must NOT change it — INSERT OR IGNORE keeps the row frozen.
    await ensureContainerConfig('ag-existing');
    expect((await getContainerConfig('ag-existing'))?.provider).toBe('codex');
  });

  it('sets and clears the timezone override (NULL = follow the install default)', async () => {
    await makeGroup('ag-tz');
    await ensureContainerConfig('ag-tz');
    expect((await getContainerConfig('ag-tz'))?.timezone).toBeNull();

    await updateContainerConfigScalars('ag-tz', { timezone: 'Asia/Tokyo' });
    expect((await getContainerConfig('ag-tz'))?.timezone).toBe('Asia/Tokyo');

    // `ncl groups config update --timezone ""` maps to null — the clear path.
    await updateContainerConfigScalars('ag-tz', { timezone: null });
    expect((await getContainerConfig('ag-tz'))?.timezone).toBeNull();
  });
});
