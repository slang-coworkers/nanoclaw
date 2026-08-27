/**
 * Echo-drop: suppress no-op coworker→coworker messages before they wake a
 * container and replay its (often huge) context.
 *
 * Motivation: a single Slang Triage session once woke ~17,000 times emitting
 * the literal word "Ignored." in response to repeated "No response." echo
 * pings from a peer coworker — each wake replaying ~442k tokens of context to
 * do nothing. That one runaway was ~21% of a month's Claude spend. Cost is
 * `context_size × turn_count`, so the cheapest fix is to NOT wake at all for
 * messages that demand no action.
 *
 * Two independent signals (either one drops):
 *   1. Pattern  — the text is a known no-op (an ack/echo with no request).
 *   2. Loop     — the same normalized text has arrived from the same source
 *                 ≥ N times within a short window to the same target session
 *                 (a loop signature, regardless of the exact wording).
 *
 * A drop is NOT a discard: callers still persist the row as context-only
 * (`trigger: 0`) so nothing is lost from the agent's view — only the expensive
 * wake is skipped. See the call site in agent-route.ts.
 *
 * This decision is intentionally content-only and host-local (an in-memory
 * ring buffer, no DB) so it is cheap to evaluate on every a2a route.
 */

const REPEAT_N = Math.max(2, parseInt(process.env.ECHO_DROP_REPEAT_N || '3', 10) || 3);
const WINDOW_MS = Math.max(1, parseInt(process.env.ECHO_DROP_WINDOW_S || '120', 10) || 120) * 1000;

/**
 * Known no-op signatures (compared against the normalized text). These are
 * messages that, by construction, carry no actionable request — pure acks,
 * hold/echo notes, and the empty string. Keep this list small and exact; the
 * loop detector below catches novel echo shapes that aren't enumerated here.
 */
const NOOP_PATTERNS: RegExp[] = [
  /^no response\.?$/,
  /^no response (?:requested|needed|required)\.?$/,
  /^\(?no response\)?\.?$/,
  /^(?:ack|acknowledged|noted|ok|okay)\.?$/,
  /^\.+$/, // bare "." / "..." holding turns
  /^$/, // empty
];

/** Recent (text-hash, timestamp) seen per target session, for loop detection. */
const recent = new Map<string, { hash: string; at: number }[]>();

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Tiny stable string hash (djb2) — avoids retaining full message text in memory.
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

function isNoopPattern(norm: string): boolean {
  return NOOP_PATTERNS.some((re) => re.test(norm));
}

/**
 * Extract the human-facing text from an a2a message content blob. Content is
 * a JSON string ({ text, sender, ... }); fall back to the raw string if it
 * isn't JSON. Returns '' when there is no text field.
 */
export function extractText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    return typeof parsed.text === 'string' ? parsed.text : '';
  } catch {
    return content;
  }
}

export interface EchoDropDecision {
  drop: boolean;
  /** Why it was dropped — for logging/audit. Empty when drop=false. */
  reason: '' | 'noop_pattern' | 'loop_repeat';
}

/**
 * Decide whether an inbound coworker message to `targetSessionId` is a no-op
 * echo that should be persisted as context but NOT wake the container.
 *
 * Pure-ish: it records the message in the per-session ring buffer as a side
 * effect (needed for loop detection), so call it exactly once per routed
 * message. A message that is dropped by pattern is still recorded so it
 * counts toward a subsequent loop.
 */
export function evaluateEchoDrop(
  targetSessionId: string,
  sourceSessionId: string,
  text: string,
  now = Date.now(),
): EchoDropDecision {
  const norm = normalize(text);
  const h = hash(norm);

  // Loop detection is keyed on the (target, source) PAIR — a loop is the same
  // source spamming the same target. Keying on target alone (the prior bug)
  // caused a fan-in false positive: N distinct coworkers each sending an
  // identical short status ("done") to one orchestrator within the window
  // tripped the counter and dropped the N-th legitimate report, so the
  // orchestrator was never woken. The (target, source) key is joined with a
  // NUL byte, which a session id can never contain.
  const key = `${targetSessionId}\x00${sourceSessionId}`;
  const buf = (recent.get(key) ?? []).filter((e) => now - e.at < WINDOW_MS);
  // Count prior occurrences of this exact normalized text in the window.
  const priorSame = buf.reduce((n, e) => n + (e.hash === h ? 1 : 0), 0);
  buf.push({ hash: h, at: now });
  // Cap retained history so a long-lived pair can't grow this unbounded.
  if (buf.length > 64) buf.splice(0, buf.length - 64);
  recent.set(key, buf);

  if (isNoopPattern(norm)) return { drop: true, reason: 'noop_pattern' };
  // priorSame counts occurrences BEFORE this one; this message is the
  // (priorSame+1)-th. Drop once it reaches the repeat threshold.
  if (priorSame + 1 >= REPEAT_N) return { drop: true, reason: 'loop_repeat' };
  return { drop: false, reason: '' };
}

/** Test/maintenance hook: forget all per-session loop history. */
export function _resetEchoDropState(): void {
  recent.clear();
}
