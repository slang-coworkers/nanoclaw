import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('findOrphanGroupDirs', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'orphan-groups-'));
    fs.mkdirSync(path.join(tmp, 'groups'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  async function withConfig<T>(fn: () => Promise<T>): Promise<T> {
    // GROUPS_DIR is resolved from PROJECT_ROOT in config.ts. We mock the
    // module to point at our temp dir so findOrphanGroupDirs scans that.
    vi.doMock('./config.js', () => ({
      GROUPS_DIR: path.join(tmp, 'groups'),
    }));
    return fn();
  }

  function stubDb(knownFolders: string[]): Parameters<typeof import('./orphan-groups.js').findOrphanGroupDirs>[0] {
    return {
      all: async () => knownFolders.map((folder) => ({ folder })),
    } as unknown as Parameters<typeof import('./orphan-groups.js').findOrphanGroupDirs>[0];
  }

  it('returns folders on disk that have no matching agent_groups row', async () => {
    fs.mkdirSync(path.join(tmp, 'groups', 'known'));
    fs.mkdirSync(path.join(tmp, 'groups', 'orphan-a'));
    fs.mkdirSync(path.join(tmp, 'groups', 'orphan-b'));

    await withConfig(async () => {
      const { findOrphanGroupDirs } = await import('./orphan-groups.js');
      const orphans = await findOrphanGroupDirs(stubDb(['known']));
      expect(orphans).toEqual(['orphan-a', 'orphan-b']);
    });
  });

  it('ignores files and dotfolders — only real dirs count', async () => {
    fs.mkdirSync(path.join(tmp, 'groups', '.hidden'));
    fs.writeFileSync(path.join(tmp, 'groups', 'README.md'), 'x');
    fs.mkdirSync(path.join(tmp, 'groups', 'orphan'));

    await withConfig(async () => {
      const { findOrphanGroupDirs } = await import('./orphan-groups.js');
      const orphans = await findOrphanGroupDirs(stubDb([]));
      expect(orphans).toEqual(['orphan']);
    });
  });

  it('returns [] when every on-disk folder matches a DB row', async () => {
    fs.mkdirSync(path.join(tmp, 'groups', 'a'));
    fs.mkdirSync(path.join(tmp, 'groups', 'b'));

    await withConfig(async () => {
      const { findOrphanGroupDirs } = await import('./orphan-groups.js');
      const orphans = await findOrphanGroupDirs(stubDb(['a', 'b']));
      expect(orphans).toEqual([]);
    });
  });

  it('returns [] when the groups dir does not exist', async () => {
    fs.rmSync(path.join(tmp, 'groups'), { recursive: true });

    await withConfig(async () => {
      const { findOrphanGroupDirs } = await import('./orphan-groups.js');
      const orphans = await findOrphanGroupDirs(stubDb(['a']));
      expect(orphans).toEqual([]);
    });
  });
});
