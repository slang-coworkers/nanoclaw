import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { SqliteDriver } from '../drivers/sqlite.js';
import { migration952 } from './952-pin-groups-before-open-default.js';

async function run(raw: Database.Database): Promise<void> {
  if (migration952.sqliteOnly) throw new Error('migration952 is portable — expected the DbDriver signature');
  await migration952.up(new SqliteDriver(raw));
}

describe('migration952 — existing groups keep what they ran on before the open default', () => {
  it('writes claude and any into the empty columns, and leaves every named value alone', async () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE agent_groups (id TEXT PRIMARY KEY, agent_provider TEXT);
      CREATE TABLE container_configs (agent_group_id TEXT PRIMARY KEY, provider TEXT, weights TEXT);
    `);
    const group = db.prepare('INSERT INTO agent_groups (id, agent_provider) VALUES (?, ?)');
    const config = db.prepare('INSERT INTO container_configs (agent_group_id, provider, weights) VALUES (?, ?, ?)');
    // An eval group: nothing named, so it ran Claude without the rule.
    group.run('eval', null);
    config.run('eval', null, null);
    // An empty string is as unset as NULL to resolution.
    group.run('blank', '');
    config.run('blank', '', '');
    // The group tier names a provider: only the weights are empty.
    group.run('group-opencode', 'opencode');
    config.run('group-opencode', null, null);
    // The config tier names a provider.
    group.run('config-codex', null);
    config.run('config-codex', 'codex', null);
    // Already open.
    group.run('open', 'opencode');
    config.run('open', null, 'open');
    // No config row yet: backfillContainerConfigs writes it.
    group.run('row-less', null);

    await run(db);
    await run(db); // idempotent

    expect(db.prepare('SELECT agent_group_id, provider, weights FROM container_configs ORDER BY 1').all()).toEqual([
      { agent_group_id: 'blank', provider: 'claude', weights: 'any' },
      { agent_group_id: 'config-codex', provider: 'codex', weights: 'any' },
      { agent_group_id: 'eval', provider: 'claude', weights: 'any' },
      { agent_group_id: 'group-opencode', provider: null, weights: 'any' },
      { agent_group_id: 'open', provider: null, weights: 'open' },
    ]);
    expect(db.prepare('SELECT id, agent_provider FROM agent_groups ORDER BY 1').all()).toEqual([
      { id: 'blank', agent_provider: '' },
      { id: 'config-codex', agent_provider: null },
      { id: 'eval', agent_provider: null },
      { id: 'group-opencode', agent_provider: 'opencode' },
      { id: 'open', agent_provider: 'opencode' },
      { id: 'row-less', agent_provider: null },
    ]);
  });
});
