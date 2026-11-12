import { describe, expect, it, vi } from 'vitest';

import { ghLookups, limitConcurrency, orgMemberArgs, permissionArgs } from './github-lookups.js';

describe('gh argument builders', () => {
  it('asks for the repo permission of one login', () => {
    expect(permissionArgs('shader-slang/slang', 'alice')).toEqual([
      'api',
      'repos/shader-slang/slang/collaborators/alice/permission',
      '--jq',
      '.permission',
    ]);
  });

  it('asks GraphQL for org membership, passing values as variables', () => {
    const args = orgMemberArgs('shader-slang', 'alice');
    expect(args.slice(0, 2)).toEqual(['api', 'graphql']);
    expect(args).toContain('login=alice');
    expect(args).toContain('org=shader-slang');
    expect(args.join(' ')).toContain('organization(login:$org)');
  });
});

describe('ghLookups', () => {
  it('maps a non-empty org login to membership and caches per login', async () => {
    const run = vi.fn(async (args: string[]) => (args[1] === 'graphql' ? 'shader-slang\n' : 'write\n'));
    const l = ghLookups(run);
    expect(await l.repoPermission('o/r', 'Alice')).toBe('write');
    expect(await l.repoPermission('o/r', 'alice')).toBe('write');
    expect(await l.orgMember('shader-slang', 'alice')).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('an empty GraphQL answer means not a member', async () => {
    const l = ghLookups(async () => '\n');
    expect(await l.orgMember('shader-slang', 'bob')).toBe(false);
  });

  it('a failed run rejects, so Check 1 can record the failure', async () => {
    const l = ghLookups(async () => {
      throw new Error('401');
    });
    await expect(l.repoPermission('o/r', 'x')).rejects.toThrow('401');
  });

  it('concurrent misses for one login share one gh run', async () => {
    let release!: (v: string) => void;
    const run = vi.fn(() => new Promise<string>((r) => (release = r)));
    const l = ghLookups(run);
    const a = l.repoPermission('o/r', 'Alice');
    const b = l.repoPermission('o/r', 'alice');
    release('write\n');
    expect(await Promise.all([a, b])).toEqual(['write', 'write']);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a failed run is not cached: the next call runs gh again', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('gh: 502')).mockResolvedValueOnce('read');
    const l = ghLookups(run);
    await expect(l.repoPermission('o/r', 'alice')).rejects.toThrow('gh: 502');
    expect(await l.repoPermission('o/r', 'alice')).toBe('read');
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('limitConcurrency', () => {
  function gated() {
    const releases: Array<(v: string) => void> = [];
    let peak = 0;
    let active = 0;
    const run = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          active++;
          peak = Math.max(peak, active);
          releases.push((v) => {
            active--;
            resolve(v);
          });
        }),
    );
    return { run, releases, peak: () => peak };
  }

  it('runs at most `max` calls at a time and starts the queued ones in order', async () => {
    const g = gated();
    const limited = limitConcurrency(g.run, 2, 10);
    const calls = ['a', 'b', 'c', 'd'].map((x) => limited([x]));
    await Promise.resolve();
    expect(g.run).toHaveBeenCalledTimes(2);
    g.releases[0]('1');
    await calls[0];
    await Promise.resolve();
    expect(g.run).toHaveBeenCalledTimes(3);
    expect(g.run.mock.calls[2]).toEqual([['c']]);
    g.releases[1]('2');
    g.releases[2]('3');
    await Promise.all(calls.slice(1, 3));
    await Promise.resolve();
    g.releases[3]('4');
    expect(await Promise.all(calls)).toEqual(['1', '2', '3', '4']);
    expect(g.peak()).toBe(2);
  });

  it('rejects at once when the queue is full, and frees the slot of a failed call', async () => {
    const g = gated();
    const limited = limitConcurrency(g.run, 1, 1);
    const first = limited(['a']);
    const queued = limited(['b']);
    await expect(limited(['c'])).rejects.toThrow('1 gh lookups already queued');
    g.releases[0]('1');
    expect(await first).toBe('1');
    await Promise.resolve();
    g.releases[1]('2');
    expect(await queued).toBe('2');
    const failing = limitConcurrency(
      async () => {
        throw new Error('gh: 502');
      },
      1,
      0,
    );
    await expect(failing(['x'])).rejects.toThrow('gh: 502');
    await expect(failing(['y'])).rejects.toThrow('gh: 502');
  });

  it('ghLookups puts its gh runs behind the limit', async () => {
    const g = gated();
    const l = ghLookups(g.run);
    const all = Array.from({ length: 6 }, (_, i) => l.repoPermission('o/r', `user${i}`));
    await Promise.resolve();
    expect(g.run).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      g.releases[i]?.('read');
      await new Promise((r) => setImmediate(r));
    }
    expect(await Promise.all(all)).toEqual(Array(6).fill('read'));
    expect(g.peak()).toBe(4);
  });
});
