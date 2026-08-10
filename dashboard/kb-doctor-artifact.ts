/**
 * Contract for `data/shared/.kb-doctor.json` — the structured drift report written by
 * `scripts/kb-doctor.py` (schema 1) and rendered by the dashboard's `/api/kb-health`.
 *
 * WHY THIS IS A MODULE AND NOT AN `if` IN THE ROUTE. The route previously validated
 * `raw.schema === 1` and then trusted every other field. That is not a small gap: the
 * panel's whole purpose is to answer "is the KB drifting", and an artifact that is
 * malformed, contradictory or a week old could still render as available, fresh and
 * ZERO DRIFT. `counts.drift: 0` alongside a non-empty `drift` array reported zero —
 * the exact false zero the structured artifact was introduced to eliminate.
 *
 * So the rule here is: **a report we cannot fully understand is UNAVAILABLE, never
 * clean.** Every rejection carries a specific reason, because "unavailable" with no
 * cause is the same dead end as a silent zero.
 *
 * The producer's shape, verbatim from kb-doctor.py's `doc`:
 *
 *   schema      1
 *   generatedAt datetime.now(timezone.utc).isoformat(timespec="seconds")  → "…+00:00"
 *   status      "clean" | "drift" | "unknown"     (worst-of across checks)
 *   complete    bool — false means at least one check could not run
 *   counts      {ok, drift, unknown}              non-negative ints
 *   drift       list[str]                         len == counts.drift
 *   unknown     list[str]                         len == counts.unknown
 */

export const KB_DOCTOR_SCHEMA = 1;
export const KB_DOCTOR_STATUSES = ['clean', 'drift', 'unknown'] as const;
export type KbDoctorStatus = (typeof KB_DOCTOR_STATUSES)[number];

/** Daily 05:45 cron; beyond this a run was missed. */
export const DOCTOR_STALE_HOURS = 36;
/**
 * Clock skew we will forgive on a future timestamp. Beyond it the artifact is wrong
 * rather than early: an unbounded future stamp made `ageHours` negative and `stale`
 * false, so a report from next Tuesday read as the freshest possible evidence.
 */
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface KbDoctorView {
  available: boolean;
  status: KbDoctorStatus | null;
  complete: boolean | null;
  generatedAt: string | null;
  ageHours: number | null;
  stale: boolean;
  driftCount: number | null;
  unknownCount: number | null;
  drift: string[];
  unknown: string[];
  reason: string | null;
}

/** Every rejection lands here, so "unavailable" always arrives with a cause. */
export function kbDoctorUnavailable(reason: string): KbDoctorView {
  return {
    available: false,
    status: null,
    complete: null,
    generatedAt: null,
    ageHours: null,
    stale: false,
    driftCount: null,
    unknownCount: null,
    drift: [],
    unknown: [],
    reason,
  };
}

/**
 * An unambiguous instant: ISO-8601 with an EXPLICIT offset (`Z` or `±HH:MM`).
 *
 * Offset-less strings are rejected on purpose. `new Date("2026-08-10 05:45:01")` is
 * interpreted in the reader's local zone, which silently shifts `ageHours` by the
 * host's UTC offset — the misparse this repo's Timestamps policy exists to forbid.
 * A stamp we cannot place on the timeline cannot support a staleness claim.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

/**
 * Validate a parsed `.kb-doctor.json` and project it for the API.
 *
 * `nowMs` is injected so staleness and future-clock behaviour are testable without
 * waiting or faking a system clock.
 */
export function readKbDoctorArtifact(raw: unknown, nowMs: number = Date.now()): KbDoctorView {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return kbDoctorUnavailable(
      `kb-doctor report is ${Array.isArray(raw) ? 'an array' : typeof raw}, expected an object`,
    );
  }
  const o = raw as Record<string, unknown>;

  if (o.schema !== KB_DOCTOR_SCHEMA) {
    return kbDoctorUnavailable(`unsupported kb-doctor schema: ${String(o.schema)}`);
  }

  if (typeof o.generatedAt !== 'string' || !ISO_INSTANT.test(o.generatedAt)) {
    return kbDoctorUnavailable(
      `kb-doctor generatedAt is not an ISO-8601 instant with an explicit offset: ${JSON.stringify(o.generatedAt)}`,
    );
  }
  const generatedMs = new Date(o.generatedAt).getTime();
  if (!Number.isFinite(generatedMs)) {
    return kbDoctorUnavailable(`kb-doctor generatedAt does not parse: ${o.generatedAt}`);
  }
  if (generatedMs > nowMs + FUTURE_TOLERANCE_MS) {
    return kbDoctorUnavailable(`kb-doctor generatedAt is in the future: ${o.generatedAt}`);
  }

  if (typeof o.status !== 'string' || !(KB_DOCTOR_STATUSES as readonly string[]).includes(o.status)) {
    return kbDoctorUnavailable(`unrecognised kb-doctor status: ${JSON.stringify(o.status)}`);
  }
  if (typeof o.complete !== 'boolean') {
    return kbDoctorUnavailable(`kb-doctor complete is not a boolean: ${JSON.stringify(o.complete)}`);
  }

  const counts = o.counts;
  if (typeof counts !== 'object' || counts === null || Array.isArray(counts)) {
    return kbDoctorUnavailable('kb-doctor counts is missing or not an object');
  }
  const c = counts as Record<string, unknown>;
  if (!isNonNegativeInt(c.drift) || !isNonNegativeInt(c.unknown)) {
    return kbDoctorUnavailable(
      `kb-doctor counts must be non-negative integers, got drift=${JSON.stringify(c.drift)} unknown=${JSON.stringify(c.unknown)}`,
    );
  }
  if (!isStringArray(o.drift) || !isStringArray(o.unknown)) {
    return kbDoctorUnavailable('kb-doctor drift/unknown must be arrays of strings');
  }

  // The cross-check. A count that disagrees with its own array is the false-zero
  // shape: the panel shows the tally, the detail list shows the findings, and a
  // reader who trusts the tally is told there is nothing to look at.
  if (c.drift !== o.drift.length || c.unknown !== o.unknown.length) {
    return kbDoctorUnavailable(
      `kb-doctor counts disagree with their arrays: drift ${c.drift} vs ${o.drift.length}, ` +
        `unknown ${c.unknown} vs ${o.unknown.length}`,
    );
  }

  // `status` is worst-of across checks, so it must not contradict the findings either.
  const expected: KbDoctorStatus = o.drift.length ? 'drift' : o.unknown.length ? 'unknown' : 'clean';
  if (o.status !== expected) {
    return kbDoctorUnavailable(
      `kb-doctor status "${o.status}" contradicts its findings (${o.drift.length} drift, ${o.unknown.length} unknown)`,
    );
  }
  // `complete: false` means a check could not run, which is exactly what a non-empty
  // unknown list records. These two disagreeing means one of them is wrong, and a
  // consumer must not pick.
  if (o.complete !== (o.unknown.length === 0)) {
    return kbDoctorUnavailable(`kb-doctor complete=${o.complete} contradicts ${o.unknown.length} unknown finding(s)`);
  }

  const ageHours = (nowMs - generatedMs) / 3_600_000;
  return {
    available: true,
    status: o.status as KbDoctorStatus,
    complete: o.complete,
    generatedAt: o.generatedAt,
    ageHours: Math.round(ageHours * 10) / 10,
    stale: ageHours > DOCTOR_STALE_HOURS,
    driftCount: c.drift,
    unknownCount: c.unknown,
    drift: o.drift,
    unknown: o.unknown,
    reason: null,
  };
}
