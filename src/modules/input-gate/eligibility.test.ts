import { describe, expect, it } from 'vitest';

import { checkEligibility, unconnectedSources, type EligibilitySources } from './eligibility.js';
import type { EvidenceState, GateActor } from './types.js';

const actor: GateActor = { id: 1, login: 'alice', type: 'User', association: 'MEMBER' };

function sources(identity: EvidenceState, entity: EvidenceState, location: EvidenceState): EligibilitySources {
  return { identity: async () => identity, entity: async () => entity, location: async () => location };
}

describe('checkEligibility (Check 2)', () => {
  it('with no sources connected, nobody is eligible: not_linked', async () => {
    expect(await checkEligibility(actor, unconnectedSources)).toEqual({
      eligible: false,
      identity: 'unknown',
      entity: 'unknown',
      location: 'unknown',
      reason: 'not_linked',
    });
  });

  it('all three verified is eligible', async () => {
    const r = await checkEligibility(actor, sources('verified', 'verified', 'verified'));
    expect(r).toMatchObject({ eligible: true, reason: null });
  });

  it.each<[EvidenceState, EvidenceState, EvidenceState, string]>([
    ['expired', 'verified', 'verified', 'identity_expired'],
    ['verified', 'unknown', 'verified', 'entity_unknown'],
    ['verified', 'denied', 'verified', 'entity_denied'],
    ['verified', 'verified', 'expired', 'location_stale'],
    ['verified', 'verified', 'conflicting', 'location_conflicting'],
  ])('identity=%s entity=%s location=%s → %s', async (i, e, l, reason) => {
    const r = await checkEligibility(actor, sources(i, e, l));
    expect(r).toMatchObject({ eligible: false, reason });
  });

  it('a source that throws counts as unknown', async () => {
    const r = await checkEligibility(actor, {
      identity: async () => {
        throw new Error('down');
      },
      entity: async () => 'verified',
      location: async () => 'verified',
    });
    expect(r).toMatchObject({ eligible: false, identity: 'unknown', reason: 'not_linked' });
  });
});
