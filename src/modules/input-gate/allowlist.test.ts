import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkAllowlist, loadRoster, type GitHubLookups } from './allowlist.js';
import type { GateActor } from './types.js';

const repo = 'shader-slang/slang';
const org = 'shader-slang';

function actor(over: Partial<GateActor> = {}): GateActor {
  return { id: 101, login: 'alice', type: 'User', association: 'NONE', ...over };
}

function lookups(
  permission: string | Error,
  orgMember: boolean | Error,
): GitHubLookups & {
  repoPermission: ReturnType<typeof vi.fn>;
  orgMember: ReturnType<typeof vi.fn>;
} {
  return {
    repoPermission: vi.fn(async () => {
      if (permission instanceof Error) throw permission;
      return permission;
    }),
    orgMember: vi.fn(async () => {
      if (orgMember instanceof Error) throw orgMember;
      return orgMember;
    }),
  };
}

describe('checkAllowlist (Check 1)', () => {
  it('a roster hit by numeric id is allowlisted without any lookup', async () => {
    const l = lookups('read', false);
    const r = await checkAllowlist(actor({ id: 7 }), { repo, org, roster: new Set([7]), lookups: l });
    expect(r).toMatchObject({ allowlisted: true, via: 'roster', evidence: { rosterHit: true } });
    expect(l.repoPermission).not.toHaveBeenCalled();
    expect(l.orgMember).not.toHaveBeenCalled();
  });

  it.each(['NONE', 'CONTRIBUTOR', 'FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR', 'MANNEQUIN'])(
    'association %s is external without a lookup',
    async (association) => {
      const l = lookups('admin', true);
      const r = await checkAllowlist(actor({ association }), { repo, org, roster: new Set(), lookups: l });
      expect(r).toMatchObject({ allowlisted: false, via: null });
      expect(l.repoPermission).not.toHaveBeenCalled();
    },
  );

  it.each(['admin', 'maintain', 'write'])('repo permission %s is allowlisted', async (permission) => {
    const l = lookups(permission, false);
    const r = await checkAllowlist(actor({ association: 'COLLABORATOR' }), {
      repo,
      org,
      roster: new Set(),
      lookups: l,
    });
    expect(r).toMatchObject({ allowlisted: true, via: 'permission', evidence: { permission } });
    expect(l.orgMember).not.toHaveBeenCalled();
  });

  it('read permission falls through to org membership', async () => {
    const l = lookups('read', true);
    const r = await checkAllowlist(actor({ association: 'MEMBER' }), { repo, org, roster: new Set(), lookups: l });
    expect(r).toMatchObject({
      allowlisted: true,
      via: 'org_member',
      evidence: { permission: 'read', orgMember: true },
    });
    expect(l.orgMember).toHaveBeenCalledWith(org, 'alice');
  });

  it('read permission and no org membership is external', async () => {
    const l = lookups('triage', false);
    const r = await checkAllowlist(actor({ association: 'OWNER' }), { repo, org, roster: new Set(), lookups: l });
    expect(r).toMatchObject({ allowlisted: false, via: null, evidence: { permission: 'triage', orgMember: false } });
  });

  it('an event with no association (a label sender) still runs the lookups', async () => {
    const l = lookups('write', false);
    const r = await checkAllowlist(actor({ association: null }), { repo, org, roster: new Set(), lookups: l });
    expect(r).toMatchObject({ allowlisted: true, via: 'permission' });
  });

  it('a failed lookup is not allowlisted and records which lookup failed', async () => {
    const l = lookups(new Error('401'), new Error('timeout'));
    const r = await checkAllowlist(actor({ association: 'MEMBER' }), { repo, org, roster: new Set(), lookups: l });
    expect(r).toMatchObject({ allowlisted: false, evidence: { lookupError: 'permission' } });
  });

  it('an org lookup failure alone is recorded as org', async () => {
    const l = lookups('read', new Error('timeout'));
    const r = await checkAllowlist(actor({ association: 'MEMBER' }), { repo, org, roster: new Set(), lookups: l });
    expect(r).toMatchObject({ allowlisted: false, evidence: { lookupError: 'org' } });
  });
});

describe('loadRoster', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  function write(content: string): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));
    const p = path.join(dir, 'roster.json');
    fs.writeFileSync(p, content);
    return p;
  }

  it('reads numeric github_id entries and ignores malformed ones', () => {
    const p = write(
      JSON.stringify([
        { github_id: 1, login: 'a' },
        { github_id: '2' },
        { login: 'c' },
        { github_id: 3.5 },
        { github_id: 4 },
      ]),
    );
    expect([...loadRoster(p)]).toEqual([1, 4]);
  });

  it('a missing file is an empty roster', () => {
    expect(loadRoster('/nonexistent/roster.json').size).toBe(0);
  });

  it('invalid JSON or a non-array is an empty roster', () => {
    expect(loadRoster(write('not json')).size).toBe(0);
    expect(loadRoster(write('{"github_id":1}')).size).toBe(0);
  });
});
