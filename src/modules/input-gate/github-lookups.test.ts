import { describe, expect, it, vi } from 'vitest';

import { ghLookups, orgMemberArgs, permissionArgs } from './github-lookups.js';

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
});
