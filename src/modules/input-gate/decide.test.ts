import { describe, expect, it, vi } from 'vitest';

import type { GitHubLookups } from './allowlist.js';
import { decide, type DecideContext } from './decide.js';
import { unconnectedSources, type EligibilitySources } from './eligibility.js';
import type { OpenLane } from './open-lane.js';
import type { GateRequest } from './types.js';

function ctx(over: Partial<DecideContext> = {}, lookups?: Partial<GitHubLookups>): DecideContext {
  return {
    org: 'shader-slang',
    roster: new Set([7]),
    lookups: { repoPermission: vi.fn(async () => 'read'), orgMember: vi.fn(async () => false), ...lookups },
    eligibility: unconnectedSources,
    ...over,
  };
}

function req(over: Partial<GateRequest> = {}): GateRequest {
  return {
    deliveryId: 'd-1',
    event: 'comment',
    repo: 'shader-slang/slang',
    number: 1,
    actor: { id: 7, login: 'maint', type: 'User', association: 'MEMBER' },
    startsWork: true,
    ...over,
  };
}

const verified: EligibilitySources = {
  identity: async () => 'verified',
  entity: async () => 'verified',
  location: async () => 'verified',
};

describe('decide (one gate, two checks)', () => {
  it.each(['pr_closed', 'review_thread', 'check_suite', 'other'] as const)('%s is a system event', async (event) => {
    const d = await decide(req({ event, actor: null, startsWork: false }), ctx());
    expect(d).toMatchObject({ outcome: 'system_event', tier: 'n/a', allowlist: null });
  });

  it("the bot's own user login is judged as the bot, not as a person", async () => {
    const self = { id: 9, login: 'nv-slang-bot', type: 'User', association: 'NONE' };
    const c = ctx({ selfLogins: new Set(['nv-slang-bot']) });
    expect(await decide(req({ actor: self, event: 'pr_reviewable', startsWork: false }), c)).toMatchObject({
      outcome: 'bot',
    });
    expect(c.lookups.repoPermission).not.toHaveBeenCalled();
  });

  it('a Bot delivery that starts nothing is not judged', async () => {
    const c = ctx();
    const d = await decide(
      req({
        event: 'pr_reviewable',
        startsWork: false,
        actor: { id: 9, login: 'dependabot[bot]', type: 'Bot', association: 'NONE' },
      }),
      c,
    );
    expect(d.outcome).toBe('bot');
    expect(c.lookups.repoPermission).not.toHaveBeenCalled();
  });

  it('a Bot mention must pass Check 1: routing starts work on it like on a person', async () => {
    const c = ctx({}, { repoPermission: vi.fn(async () => 'write'), orgMember: vi.fn(async () => true) });
    const reviewer = { id: 66, login: 'review-app[bot]', type: 'Bot', association: 'NONE' };
    expect(await decide(req({ actor: reviewer }), c)).toMatchObject({
      outcome: 'external_blocked',
      reason: 'not_allowlisted',
      tier: 'external',
    });
    expect(c.lookups.repoPermission).not.toHaveBeenCalled();
    // An App the maintainers trust goes on the roster by its numeric id.
    expect(await decide(req({ actor: { ...reviewer, id: 7 } }), c)).toMatchObject({
      outcome: 'not_eligible',
      tier: 'allowlisted',
    });
  });

  it('write permission on a repo outside the org does not allowlist', async () => {
    const c = ctx({}, { repoPermission: vi.fn(async () => 'admin') });
    const owner = { id: 55, login: 'alice', type: 'User', association: 'OWNER' };
    expect(await decide(req({ repo: 'alice/slang', actor: owner }), c)).toMatchObject({
      outcome: 'external_blocked',
      allowlist: { evidence: { repoProtected: false } },
    });
    expect(c.lookups.repoPermission).not.toHaveBeenCalled();
    expect(c.lookups.orgMember).toHaveBeenCalledWith('shader-slang', 'alice');
  });

  it('an issue opened by a maintainer does not start work, but records the tier', async () => {
    const d = await decide(req({ event: 'issue_opened', startsWork: false }), ctx());
    expect(d).toMatchObject({ outcome: 'no_start', reason: 'no_exact_mention', tier: 'allowlisted' });
  });

  it('an external mention is blocked', async () => {
    const d = await decide(req({ actor: { id: 55, login: 'stranger', type: 'User', association: 'NONE' } }), ctx());
    expect(d).toMatchObject({ outcome: 'external_blocked', reason: 'not_allowlisted', tier: 'external' });
  });

  it('a mention runs the lookups whatever the association says; a non-mention keeps the pre-filter', async () => {
    const stranger = { id: 55, login: 'stranger', type: 'User', association: 'CONTRIBUTOR' };
    const asMention = ctx({}, { repoPermission: vi.fn(async () => 'write') });
    expect(await decide(req({ actor: stranger }), asMention)).toMatchObject({
      outcome: 'not_eligible',
      tier: 'allowlisted',
    });

    const asIssue = ctx({}, { repoPermission: vi.fn(async () => 'write') });
    const d = await decide(req({ actor: stranger, event: 'issue_opened', startsWork: false }), asIssue);
    expect(d).toMatchObject({ outcome: 'no_start', tier: 'external' });
    expect(asIssue.lookups.repoPermission).not.toHaveBeenCalled();
  });

  it('an external block caused by a failed lookup names the lookup', async () => {
    const d = await decide(
      req({ actor: { id: 55, login: 'x', type: 'User', association: 'MEMBER' } }),
      ctx(
        {},
        {
          repoPermission: async () => {
            throw new Error('401');
          },
        },
      ),
    );
    expect(d).toMatchObject({ outcome: 'external_blocked', reason: 'lookup_failed_permission' });
  });

  it('an allowlisted mention with no eligibility source is not eligible (not_linked)', async () => {
    const d = await decide(req(), ctx());
    expect(d).toMatchObject({ outcome: 'not_eligible', reason: 'not_linked', tier: 'allowlisted' });
    expect(d.eligibility?.identity).toBe('unknown');
  });

  it('an allowlisted, eligible mention is admitted', async () => {
    const d = await decide(req(), ctx({ eligibility: verified }));
    expect(d).toMatchObject({ outcome: 'admitted', reason: null, tier: 'allowlisted' });
  });

  it('eligibility is only read for an allowlisted mention', async () => {
    const identity = vi.fn<EligibilitySources['identity']>(async () => 'verified');
    await decide(
      req({ actor: { id: 55, login: 's', type: 'User', association: 'NONE' } }),
      ctx({
        eligibility: { ...verified, identity },
      }),
    );
    await decide(req({ startsWork: false }), ctx({ eligibility: { ...verified, identity } }));
    expect(identity).not.toHaveBeenCalled();
  });

  it('a person who fails Check 2 goes to a ready open-weights lane, keeping the Check 2 reason', async () => {
    const openLane = async (): Promise<OpenLane> => ({ status: 'ready', folder: 'lane', agentGroupId: 'ag-lane' });
    expect(await decide(req(), ctx({ openLane }))).toMatchObject({
      outcome: 'open_lane',
      reason: 'not_linked',
      tier: 'allowlisted',
    });
  });

  it('an unset or invalid lane leaves the person not eligible', async () => {
    for (const lane of [
      { status: 'unset' },
      { status: 'invalid', folder: 'lane', problem: 'the group is not weights=open' },
    ] satisfies OpenLane[]) {
      expect(await decide(req(), ctx({ openLane: async () => lane }))).toMatchObject({
        outcome: 'not_eligible',
        reason: 'not_linked',
      });
    }
  });

  it('the lane is read only for a person who fails Check 2', async () => {
    const openLane = vi.fn(async (): Promise<OpenLane> => ({ status: 'unset' }));
    const stranger = { id: 55, login: 's', type: 'User', association: 'NONE' };
    await decide(req({ actor: stranger }), ctx({ openLane }));
    await decide(req({ startsWork: false }), ctx({ openLane }));
    await decide(req(), ctx({ openLane, eligibility: verified }));
    expect(openLane).not.toHaveBeenCalled();
  });
});
