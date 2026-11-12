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
 *   NANOCLAW_INPUT_GATE_REPOS   comma-separated repos whose write permission
 *                               counts for Check 1 (default: every org repo)
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

const KEYS = [
  'NANOCLAW_INPUT_GATE',
  'NANOCLAW_INPUT_GATE_ROSTER',
  'NANOCLAW_INPUT_GATE_ORG',
  'NANOCLAW_INPUT_GATE_REPOS',
];

export interface GateSettings {
  mode: 'off' | 'shadow';
  rosterPath: string;
  org: string;
  /** Repos whose write permission counts for Check 1; null means every repo of the org. */
  repos: string[] | null;
}

export function readGateSettings(): GateSettings {
  const file = readEnvFile(KEYS);
  const val = (k: string) => (process.env[k] || file[k] || '').trim();
  return {
    mode: val('NANOCLAW_INPUT_GATE').toLowerCase() === 'shadow' ? 'shadow' : 'off',
    rosterPath: path.resolve(val('NANOCLAW_INPUT_GATE_ROSTER') || 'data/input-gate-roster.json'),
    org: val('NANOCLAW_INPUT_GATE_ORG') || 'shader-slang',
    repos: parseRepoList(val('NANOCLAW_INPUT_GATE_REPOS')),
  };
}

/** Parse a comma-separated `owner/name` list; empty means "not set". */
function parseRepoList(value: string): string[] | null {
  const repos = value
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  return repos.length > 0 ? repos : null;
}

export interface ObserveInput {
  eventType: string;
  rawBody: string;
  deliveryId: string;
  botMention: string;
  /** This instance's own GitHub logins: its pushes are the bot's, not a person's. */
  selfLogins?: ReadonlySet<string>;
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
      selfLogins: input.selfLogins,
      repos: settings.repos,
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

const pending = new Set<Promise<unknown>>();

/**
 * Observe a delivery after the caller has returned, so not even the settings
 * read or the payload parse runs before routing's response goes out. Tracked
 * so a graceful shutdown can wait for the decision row (drainInputGate); the
 * inbox marks the delivery complete at once, so a lost row is never replayed.
 */
export function scheduleGitHubObservation(input: ObserveInput): void {
  const run = new Promise<void>((resolve) => setImmediate(resolve)).then(() => observeGitHubDelivery(input));
  pending.add(run);
  void run.finally(() => pending.delete(run));
}

/**
 * Shutdown step: wait for scheduled observations before the DB closes. Loops
 * because an inbox replay still in flight can schedule one while we wait, and
 * gives up after `budgetMs`: a gh lookup can take 15 s, and the whole host
 * shutdown has 7 s. A row still pending then is lost, as on a crash.
 */
export async function drainInputGate(budgetMs = 2000): Promise<void> {
  const deadline = Date.now() + budgetMs;
  while (pending.size > 0) {
    const left = deadline - Date.now();
    if (left <= 0) {
      log.warn('input-gate: shutdown left shadow decisions unrecorded', { pending: pending.size });
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => (timer = setTimeout(resolve, left)));
    await Promise.race([Promise.allSettled([...pending]), timeout]);
    clearTimeout(timer);
  }
}
