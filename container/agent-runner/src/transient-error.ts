/**
 * Classify a failed turn's error text so the host can decide how to redrive a
 * bounced agent-to-agent (a2a) handoff.
 *
 * CONTRACT: the caller has ALREADY established that the turn failed — this is
 * gated on the provider's structured `event.isError === true` flag (see
 * poll-loop.ts). This function does NOT decide "did it fail"; it only splits an
 * already-failed a2a turn into a retry policy:
 *
 *   'permanent' — a genuine, non-retryable failure (403 billing, invalid key,
 *                 permission/refusal). NEVER redrive; deliver as today.
 *   'transient' — a KNOWN transient outage (auth proxy down, gateway 5xx,
 *                 overload). Redrive with the long, outage-scale budget.
 *   'unknown'   — an isError turn that matches neither list. Redrive with a
 *                 SMALL budget then dead-letter fast, so a truly permanent
 *                 failure that dodged the denylist cannot hide for hours.
 *
 * This is allowlist-driven on purpose (NOT fail-open-to-transient): the #12097
 * incident was a KNOWN transient ("Not logged in · Please run /login"); a novel
 * error should escalate quickly, not silently retry for an hour.
 *
 * The supervise-issues scanner mirrors these signature lists in
 * scripts/pull-universe.sh (classify_error_text) for board explainability —
 * keep the two in sync. The host redrive is the authoritative actor.
 */

export type TurnErrorClass = 'transient' | 'unknown' | 'permanent';

// Non-retryable. A turn whose error matches any of these is a real refusal or a
// billing/credential fault that retrying cannot fix.
const PERMANENT_SIGNATURES = [
  'billing_error',
  'invalid api key',
  'invalid_request_error',
  'permission_error',
  'authentication_error: invalid',
];

// Known transient outages — safe to redrive on the long budget. These are the
// proxy/gateway/auth-outage shapes that recover on their own within minutes-to-
// hours (the class the #12097 auth outage fell into).
//
// Two arrival shapes land here (see poll-loop.ts): a STRUCTURED isError result
// yielded by the provider, and a THROWN error whose message the SDK builds as
// "Claude Code returned an error result: <text>" when the response stream dies
// mid-read. The transport-death shapes below (connection closed mid-response,
// ECONNRESET, socket-closed-unexpectedly, connection refused/timed out) only
// ever surface via the thrown path — a mid-response disconnect never produces a
// clean structured result — so they must be classified transient here for the
// outer-catch bounce to redrive them instead of silently completing the handoff.
const TRANSIENT_SIGNATURES = [
  'not logged in',
  'please run /login',
  'econnrefused',
  'econnreset',
  'etimedout',
  'connection closed mid-response',
  'connection refused',
  'connection reset',
  'socket connection was closed',
  'socket hang up',
  'unable to connect to api',
  'bad gateway',
  'gateway timeout',
  'service unavailable',
  'overloaded_error',
  '502',
  '503',
  '504',
];

/**
 * Return the retry class for an already-failed turn's error text.
 *
 * @param text the provider's error result / thrown-error message
 */
export function classifyTurnError(text: string | null | undefined): TurnErrorClass {
  const low = (text ?? '').toLowerCase();
  // Permanent wins if present — never redrive a billing/credential refusal.
  if (PERMANENT_SIGNATURES.some((s) => low.includes(s))) return 'permanent';
  if (TRANSIENT_SIGNATURES.some((s) => low.includes(s))) return 'transient';
  // isError was true but the text matches nothing we recognize → small budget.
  return 'unknown';
}
