/**
 * Host input gate for GitHub deliveries — "one gate, two checks" (threat model
 * §5 P0-1). Check 1 asks whether the actor is on the allowlist; Check 2 asks
 * whether that person is eligible for Claude work now. See docs/input-gate.md.
 *
 * This module only runs in SHADOW mode: it decides and logs, and blocks
 * nothing. Routing never waits for it and never sees its result, so the log
 * can measure what each rule would stop before anyone turns enforcement on.
 *
 * Settings are read from .env / the environment on each call rather than from
 * config.ts, so the webhook tests' hand-written config mocks need no new keys:
 *   NANOCLAW_INPUT_GATE         off (default) | shadow
 *   NANOCLAW_INPUT_GATE_ROSTER  path to the maintainer roster JSON
 *                               (default data/input-gate-roster.json)
 *   NANOCLAW_INPUT_GATE_ORG     org whose members count as allowlisted
 *                               (default shader-slang)
 */
import path from 'path';

import { readEnvFile } from '../../env.js';
import { log } from '../../log.js';
import { loadRoster, type GitHubLookups } from './allowlist.js';
import { decide } from './decide.js';
import { unconnectedSources, type EligibilitySources } from './eligibility.js';
import { ghLookups } from './github-lookups.js';
import { gateRequestFromPayload } from './request.js';
import { recordGateDecision } from './store.js';
import type { GateDecision } from './types.js';

const KEYS = ['NANOCLAW_INPUT_GATE', 'NANOCLAW_INPUT_GATE_ROSTER', 'NANOCLAW_INPUT_GATE_ORG'];

export interface GateSettings {
  mode: 'off' | 'shadow';
  rosterPath: string;
  org: string;
}

export function readGateSettings(): GateSettings {
  const file = readEnvFile(KEYS);
  const val = (k: string) => (process.env[k] || file[k] || '').trim();
  return {
    mode: val('NANOCLAW_INPUT_GATE').toLowerCase() === 'shadow' ? 'shadow' : 'off',
    rosterPath: path.resolve(val('NANOCLAW_INPUT_GATE_ROSTER') || 'data/input-gate-roster.json'),
    org: val('NANOCLAW_INPUT_GATE_ORG') || 'shader-slang',
  };
}

export interface ObserveInput {
  eventType: string;
  rawBody: string;
  deliveryId: string;
  botMention: string;
  /** What routing did with this delivery (`body.outcome` of the webhook result). */
  currentOutcome: string | null;
}

interface Deps {
  settings: () => GateSettings;
  lookups: GitHubLookups;
  eligibility: EligibilitySources;
}

let deps: Deps = { settings: readGateSettings, lookups: ghLookups(), eligibility: unconnectedSources };

/** Test seam: replace the settings reader, GitHub lookups or eligibility sources. */
export function setInputGateDepsForTest(next: Partial<Deps> | null): void {
  deps = next
    ? { ...deps, ...next }
    : { settings: readGateSettings, lookups: ghLookups(), eligibility: unconnectedSources };
}

/**
 * Evaluate one delivery and append the decision. Resolves to the decision, or
 * null when the gate is off or the delivery is not this instance's to judge
 * (forwarded to a peer, which evaluates it on arrival). Never rejects.
 */
export async function observeGitHubDelivery(input: ObserveInput): Promise<GateDecision | null> {
  try {
    const settings = deps.settings();
    if (settings.mode !== 'shadow') return null;
    if (!input.currentOutcome || input.currentOutcome === 'forwarded') return null;

    const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
    const req = gateRequestFromPayload(input.eventType, payload, input.deliveryId, input.botMention);
    const decision = await decide(req, {
      org: settings.org,
      roster: loadRoster(settings.rosterPath),
      lookups: deps.lookups,
      eligibility: deps.eligibility,
    });
    await recordGateDecision(req, decision, { mode: settings.mode, currentOutcome: input.currentOutcome });
    return decision;
    // eslint-disable-next-line no-catch-all/no-catch-all -- shadow mode must never affect delivery
  } catch (err) {
    log.warn('input-gate: shadow evaluation failed (non-fatal)', {
      delivery: input.deliveryId,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
