/**
 * Regression test for the "Container config not found for agent group: <id>"
 * crash loop on first wake of a freshly-created coworker.
 *
 * Background. As of the May 2026 DB-backed container config migration, every
 * agent_groups row must have a paired container_configs row before
 * materializeContainerJson() runs at spawn time — without one it throws
 * `Container config not found for agent group: <id>` and the host sweep
 * retries forever. The dashboard POST /api/coworkers handler inserts an
 * agent_groups row but does not insert a container_configs row, relying on
 * the spawn path's call to initGroupFilesystem (which calls
 * ensureContainerConfig) to bootstrap the row. spawnContainer must therefore
 * call initGroupFilesystem BEFORE any code path that reads container config
 * (composeCoworkerClaudeMd, resolveProviderContribution → materializeContainerJson).
 *
 * These tests pin the contract that `ensureContainerConfig` is sufficient to
 * make `materializeContainerJson` succeed for a brand-new group: if anyone
 * later changes the schema, the row defaults, or the ensure-or-create logic
 * in a way that breaks first-spawn for dashboard-created coworkers, this test
 * fails.
 */
import fs from 'fs';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_GROUPS_DIR = '/tmp/nanoclaw-container-config-bootstrap-test';

vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return { ...actual, GROUPS_DIR: TEST_GROUPS_DIR };
});

const { initTestDb, closeDb } = await import('./db/connection.js');
const { runMigrations } = await import('./db/index.js');
const { createAgentGroup } = await import('./db/agent-groups.js');
const { ensureContainerConfig, getContainerConfig, updateContainerConfigScalars } =
  await import('./db/container-configs.js');
const { materializeContainerJson } = await import('./container-config.js');

async function makeGroup(id: string, folder: string) {
  await createAgentGroup({
    id,
    name: folder,
    folder,
    created_at: new Date().toISOString(),
  });
}

beforeEach(async () => {
  if (fs.existsSync(TEST_GROUPS_DIR)) fs.rmSync(TEST_GROUPS_DIR, { recursive: true });
  fs.mkdirSync(TEST_GROUPS_DIR, { recursive: true });
  const db = await initTestDb();
  await runMigrations(db);
});

afterEach(async () => {
  await closeDb();
  if (fs.existsSync(TEST_GROUPS_DIR)) fs.rmSync(TEST_GROUPS_DIR, { recursive: true });
});

describe('container_configs bootstrap (regression: dashboard-created coworker first wake)', () => {
  it('materializeContainerJson throws when the agent_group has no container_configs row', async () => {
    // The exact state the dashboard POST /api/coworkers handler leaves behind:
    // agent_groups row inserted, but no container_configs row. Without the
    // bootstrap call in spawnContainer, this is what every first-wake hits.
    await makeGroup('ag-bare', 'bare');
    await expect(materializeContainerJson('ag-bare')).rejects.toThrow(/Container config not found/);
  });

  it('ensureContainerConfig is sufficient on its own to unjam materializeContainerJson', async () => {
    // The contract spawnContainer now relies on: a single ensureContainerConfig
    // call (made via initGroupFilesystem at the top of spawnContainer) is
    // enough to take a freshly-created agent_group from "Container config not
    // found" to a successful spawn. If a future schema change breaks this
    // (e.g. by introducing a NOT NULL column without a default), this test
    // catches it before it ships.
    await makeGroup('ag-heal', 'heal');
    await ensureContainerConfig('ag-heal');

    const config = await materializeContainerJson('ag-heal');
    expect(config.skills).toBe('all');
    expect(config.mcpServers).toEqual({});
    expect(config.packages).toEqual({ apt: [], npm: [] });
    expect(config.additionalMounts).toEqual([]);
    expect(config.groupName).toBe('heal');

    // And the materialized container.json on disk is what the container will read.
    const onDisk = fs.readFileSync(path.join(TEST_GROUPS_DIR, 'heal', 'container.json'), 'utf8');
    expect(JSON.parse(onDisk).skills).toBe('all');
  });

  it('ensureContainerConfig is idempotent (safe to call on every spawn)', async () => {
    // initGroupFilesystem runs on every wake. It must not duplicate the row,
    // throw on UNIQUE conflict, or stomp existing config when the row already
    // exists — otherwise self-mod (install_packages / add_mcp_server) edits
    // would be lost on the next spawn.
    await makeGroup('ag-idemp', 'idemp');
    await ensureContainerConfig('ag-idemp');
    const first = await getContainerConfig('ag-idemp');

    // Second call — should be a no-op, leaving the existing row untouched.
    await ensureContainerConfig('ag-idemp');
    const second = await getContainerConfig('ag-idemp');

    expect(second).toBeDefined();
    expect(second!.updated_at).toBe(first!.updated_at);
    await expect(materializeContainerJson('ag-idemp')).resolves.toBeDefined();
  });

  it('ensureContainerConfig does not clobber values written between calls', async () => {
    // Stronger idempotency check: values written by self-mod tools (e.g.
    // install_packages → updateContainerConfigScalars) between two
    // ensureContainerConfig calls must survive. Catches a future regression
    // where someone "fixes" ensureContainerConfig to use INSERT OR REPLACE,
    // which would silently wipe self-mod state on every spawn.
    await makeGroup('ag-noclobber', 'noclobber');
    await ensureContainerConfig('ag-noclobber');
    await updateContainerConfigScalars('ag-noclobber', { provider: 'codex' });
    expect((await getContainerConfig('ag-noclobber'))!.provider).toBe('codex');

    await ensureContainerConfig('ag-noclobber');
    expect((await getContainerConfig('ag-noclobber'))!.provider).toBe('codex');
  });
});
