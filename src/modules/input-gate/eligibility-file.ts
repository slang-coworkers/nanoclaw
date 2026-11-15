import fs from 'fs';

import { log } from '../../log.js';
import { evaluateEligibility, type EligibilitySources } from './eligibility.js';
import type { EligibilityResult, EvidenceState, GateActor } from './types.js';

/**
 * Check 2 evidence from a file the operator keeps, until the Entra, HR and location adapters
 * are connected. The file stands in for them behind the same `EligibilitySources` seam, so the
 * adapters replace it without a change to the gate.
 *
 * Consider a maintainer whose GitHub account has the numeric id 1234. The operator links the
 * account to an NVIDIA identity, records the employing entity, and notes where the person was
 * last seen to be, with the time:
 *
 *   {
 *     "locationMaxAgeHours": 24,
 *     "people": {
 *       "github:1234": {
 *         "identity": "verified",
 *         "entity": "verified",
 *         "location": { "state": "verified", "checkedAt": "2026-11-14T10:00:00Z" }
 *       }
 *     }
 *   }
 *
 * The key is the numeric GitHub id, because a login can be renamed or reused. A person who is
 * not in the file, an account without an id, and any value we do not understand all give
 * `unknown`, which blocks. A location that is `verified` but older than 24 hours gives
 * `expired`, so the gate reports `location_stale`. The file may shorten that window with
 * `locationMaxAgeHours` but never lengthen it. A `checkedAt` must be an ISO 8601 timestamp with
 * an explicit zone; one that is missing, malformed or in the future gives `unknown`. A missing or
 * unreadable file gives `unknown` for everyone, which is what the unconnected sources give.
 *
 * The three sources of one decision read one snapshot of the file, taken at the first source the
 * gate asks, so a file that changes mid-decision cannot mix evidence of two versions.
 */
const STATES: readonly EvidenceState[] = ['verified', 'unknown', 'expired', 'conflicting', 'denied'];
/** The longest a location may be old and still count. The file may shorten it, never lengthen it. */
const MAX_LOCATION_AGE_HOURS = 24;

interface Evidence {
  locationMaxAgeMs: number;
  people: Map<string, Record<string, unknown>>;
}

const warned = new Set<string>();
function warnOnce(key: string, message: string, fields: Record<string, unknown>): void {
  if (warned.has(key)) return;
  warned.add(key);
  log.warn(message, fields);
}

/** Read the file; null when it is missing, unreadable, or not the shape described above. */
function readEvidence(filePath: string): Evidence | null {
  let text: string;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as { locationMaxAgeHours?: unknown; people?: unknown };
    if (!parsed || typeof parsed.people !== 'object' || parsed.people === null || Array.isArray(parsed.people)) {
      throw new Error('"people" must be an object');
    }
    const hours = parsed.locationMaxAgeHours;
    if (hours !== undefined && !(typeof hours === 'number' && hours > 0 && hours <= MAX_LOCATION_AGE_HOURS)) {
      throw new Error(`"locationMaxAgeHours" must be a number above 0 and at most ${MAX_LOCATION_AGE_HOURS}`);
    }
    const people = new Map(
      Object.entries(parsed.people as Record<string, unknown>).filter(
        (entry): entry is [string, Record<string, unknown>] =>
          typeof entry[1] === 'object' && entry[1] !== null && !Array.isArray(entry[1]),
      ),
    );
    return { locationMaxAgeMs: (hours ?? MAX_LOCATION_AGE_HOURS) * 3_600_000, people };
  } catch (err) {
    warnOnce(`${filePath}\0${text.length}`, 'Input gate eligibility file ignored: every person counts as unknown', {
      path: filePath,
      error: (err as Error).message,
    });
    return null;
  }
}

const asState = (value: unknown): EvidenceState =>
  typeof value === 'string' && (STATES as readonly string[]).includes(value) ? (value as EvidenceState) : 'unknown';

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Milliseconds since the epoch for an ISO 8601 timestamp with an explicit zone, or NaN. The
 * calendar fields must be real: a day that does not exist in its month, or hour 24, is not a time.
 * `Date.parse` alone would accept a bare date, read a zone-less time in the server's zone, and
 * roll 31 February over to March.
 */
function parseTimestamp(value: unknown): number {
  const m = typeof value === 'string' ? TIMESTAMP.exec(value) : null;
  if (!m) return NaN;
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const real =
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day &&
    utc.getUTCHours() === hour &&
    utc.getUTCMinutes() === minute &&
    utc.getUTCSeconds() === second;
  if (!real) return NaN;
  const zone = m[7]!;
  if (zone === 'Z') return utc.getTime();
  const offsetHours = Number(zone.slice(1, 3));
  const offsetMinutes = Number(zone.slice(4, 6));
  if (offsetHours > 23 || offsetMinutes > 59) return NaN;
  return utc.getTime() - (zone[0] === '-' ? -1 : 1) * (offsetHours * 60 + offsetMinutes) * 60_000;
}

interface Snapshot {
  identity: EvidenceState;
  entity: EvidenceState;
  location: EvidenceState;
}

/**
 * The file key of a GitHub actor, or null for an account without a usable id. An id is a positive safe
 * integer: NaN, a fraction or a string would otherwise build a key that matches a file entry.
 */
function githubKey(actor: GateActor): string | null {
  if (typeof actor.id !== 'number' || !Number.isSafeInteger(actor.id) || actor.id <= 0) return null;
  return `github:${actor.id}`;
}

/** The evidence of one person, named by file key, in one reading of the file. */
function snapshotOf(filePath: string, key: string | null, nowMs: number): Snapshot {
  const unknown: Snapshot = { identity: 'unknown', entity: 'unknown', location: 'unknown' };
  if (key === null) return unknown;
  const evidence = readEvidence(filePath);
  const person = evidence?.people.get(key);
  if (!evidence || !person) return unknown;
  const location = person.location as { state?: unknown; checkedAt?: unknown } | undefined;
  let locationState: EvidenceState = 'unknown';
  if (typeof location === 'object' && location !== null) {
    locationState = asState(location.state);
    if (locationState === 'verified') {
      const checked = parseTimestamp(location.checkedAt);
      if (Number.isNaN(checked) || checked > nowMs) locationState = 'unknown';
      else if (nowMs - checked > evidence.locationMaxAgeMs) locationState = 'expired';
    }
  }
  return { identity: asState(person.identity), entity: asState(person.entity), location: locationState };
}

/**
 * Eligibility sources that read the operator's file. The gate asks the three sources one after the
 * other for one actor object, so the first call reads the file and the other two use that reading.
 * The next decision has a new actor object and reads the file again.
 */
export function fileEligibilitySources(filePath: string, now: () => number = Date.now): EligibilitySources {
  const snapshots = new WeakMap<GateActor, Snapshot>();
  const snapshot = (actor: GateActor): Snapshot => {
    let found = snapshots.get(actor);
    if (!found) {
      found = snapshotOf(filePath, githubKey(actor), now());
      snapshots.set(actor, found);
    }
    return found;
  };
  return {
    identity: async (actor) => snapshot(actor).identity,
    entity: async (actor) => snapshot(actor).entity,
    location: async (actor) => snapshot(actor).location,
  };
}

/**
 * Check 2 for one person, named by namespaced id (`github:1234`, `slack:U012AB3CD`), read from the
 * operator's file at once. The session-privilege module uses it on the closed path. An id of another
 * shape, a `github:` id that is not a positive safe integer, a person who is not in the file and a file
 * that cannot be read all give a verdict that blocks.
 */
export function eligibilityOfKey(filePath: string, key: string, now: () => number = Date.now): EligibilityResult {
  const wellFormed = /^[a-z][a-z-]*:\S+$/.test(key) && (!key.startsWith('github:') || /^github:[1-9][0-9]*$/.test(key));
  const safe = wellFormed && (!key.startsWith('github:') || Number.isSafeInteger(Number(key.slice(7))));
  return evaluateEligibility(snapshotOf(filePath, safe ? key : null, now()));
}
