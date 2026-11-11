import type { EligibilityResult, EvidenceState, GateActor } from './types.js';

/**
 * Check 2 (Claude access policy): is this person eligible right now?
 *
 * The policy needs a verified NVIDIA (Entra) identity linked to the GitHub
 * account, the employing entity from HR, and a current location from an
 * approved source. None of those sources is connected yet (the Entra app
 * registration and source approvals are pending), so every input is
 * `unknown` and nobody is eligible. In shadow mode that is the honest answer:
 * the log shows how much work would stop until the sources exist.
 */
export interface EligibilitySources {
  identity(actor: GateActor): Promise<EvidenceState>;
  entity(actor: GateActor): Promise<EvidenceState>;
  location(actor: GateActor): Promise<EvidenceState>;
}

export const unconnectedSources: EligibilitySources = {
  identity: async () => 'unknown',
  entity: async () => 'unknown',
  location: async () => 'unknown',
};

export async function checkEligibility(actor: GateActor, sources: EligibilitySources): Promise<EligibilityResult> {
  const read = async (f: (a: GateActor) => Promise<EvidenceState>): Promise<EvidenceState> => {
    try {
      return await f(actor);
    } catch {
      return 'unknown';
    }
  };
  const identity = await read(sources.identity);
  const entity = await read(sources.entity);
  const location = await read(sources.location);

  // Missing, expired or conflicting evidence blocks; the first failing input names the reason.
  let reason: string | null = null;
  if (identity !== 'verified') reason = identity === 'unknown' ? 'not_linked' : `identity_${identity}`;
  else if (entity !== 'verified') reason = `entity_${entity}`;
  else if (location !== 'verified') reason = location === 'expired' ? 'location_stale' : `location_${location}`;

  return { eligible: reason === null, identity, entity, location, reason };
}
