/**
 * Contract tests for the `.kb-doctor.json` reader.
 *
 * The panel these feed answers one question — "is the KB drifting?" — and the failure
 * that matters is not a crash, it is a confident zero. Every case below is a document
 * that the schema-only check accepted while it meant something else.
 */
import { readFileSync } from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { DOCTOR_STALE_HOURS, kbDoctorUnavailable, readKbDoctorArtifact } from './kb-doctor-artifact.js';

const NOW = Date.parse('2026-08-10T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

/** A well-formed schema-1 report. Overrides let each case break exactly one thing. */
function artifact(over: Record<string, unknown> = {}) {
  return {
    schema: 1,
    generatedAt: hoursAgo(2),
    repo: '/srv/nanoclaw',
    status: 'clean',
    complete: true,
    exitCode: 0,
    counts: { ok: 4, drift: 0, unknown: 0 },
    findings: [],
    drift: [],
    unknown: [],
    ...over,
  };
}

describe('kb-doctor artifact — the four states it is allowed to report', () => {
  it('accepts a clean report', () => {
    const v = readKbDoctorArtifact(artifact(), NOW);
    expect(v.available).toBe(true);
    expect(v.status).toBe('clean');
    expect(v.driftCount).toBe(0);
    expect(v.stale).toBe(false);
    expect(v.reason).toBeNull();
  });

  it('accepts drift, and reports the count from the producer’s own tally', () => {
    const v = readKbDoctorArtifact(
      artifact({ status: 'drift', counts: { ok: 2, drift: 2, unknown: 0 }, drift: ['tasks: a', 'skills: b'] }),
      NOW,
    );
    expect(v.available).toBe(true);
    expect(v.driftCount).toBe(2);
    expect(v.drift).toHaveLength(2);
  });

  it('accepts unknown with complete:false — drift and unknown are different claims', () => {
    const v = readKbDoctorArtifact(
      artifact({ status: 'unknown', complete: false, counts: { ok: 1, drift: 0, unknown: 1 }, unknown: ['tasks: x'] }),
      NOW,
    );
    expect(v.available).toBe(true);
    expect(v.complete).toBe(false);
    expect(v.unknownCount).toBe(1);
    // Critically NOT zero-drift-therefore-healthy: the caller can see 0 drift and an
    // incomplete run at the same time.
    expect(v.driftCount).toBe(0);
  });

  it('marks a report older than the daily cron as stale', () => {
    const fresh = readKbDoctorArtifact(artifact({ generatedAt: hoursAgo(DOCTOR_STALE_HOURS - 1) }), NOW);
    const old = readKbDoctorArtifact(artifact({ generatedAt: hoursAgo(DOCTOR_STALE_HOURS + 1) }), NOW);
    expect(fresh.stale).toBe(false);
    expect(old.stale).toBe(true);
    expect(old.available).toBe(true); // stale is a fact about it, not a rejection
    expect(old.ageHours).toBeCloseTo(DOCTOR_STALE_HOURS + 1, 1);
  });
});

describe('kb-doctor artifact — a report we cannot understand is UNAVAILABLE, never clean', () => {
  const rejects = (raw: unknown, matching: RegExp) => {
    const v = readKbDoctorArtifact(raw, NOW);
    expect(v.available).toBe(false);
    // The whole point: an unreadable report must not be able to render as zero.
    expect(v.driftCount).toBeNull();
    expect(v.unknownCount).toBeNull();
    expect(v.drift).toEqual([]);
    expect(v.reason).toMatch(matching);
    return v;
  };

  it('rejects an unknown schema', () => rejects(artifact({ schema: 2 }), /unsupported kb-doctor schema: 2/));
  it('rejects a non-object', () => rejects('nope', /expected an object/));
  it('rejects an array', () => rejects([artifact()], /an array/));

  it('rejects a MISSING timestamp instead of calling it fresh', () => {
    // Previously: ageHours null, stale false — i.e. presented as current.
    const v = rejects(artifact({ generatedAt: undefined }), /generatedAt is not an ISO-8601 instant/);
    expect(v.stale).toBe(false);
    expect(v.generatedAt).toBeNull();
  });

  it('rejects a timestamp with no offset — the local-time misparse', () => {
    // `new Date("2026-08-10 05:45:01")` is read in the reader's zone and silently
    // shifts ageHours by the host's UTC offset.
    rejects(artifact({ generatedAt: '2026-08-10 05:45:01' }), /explicit offset/);
  });

  it('rejects a nonsense timestamp', () => rejects(artifact({ generatedAt: 'yesterday' }), /explicit offset/));

  it('rejects a FUTURE timestamp beyond clock-skew tolerance', () => {
    // An unbounded future stamp made ageHours negative and stale false, so a report
    // from next week read as the freshest evidence available.
    rejects(artifact({ generatedAt: new Date(NOW + 48 * 3_600_000).toISOString() }), /in the future/);
  });

  it('forgives a few minutes of clock skew', () => {
    const v = readKbDoctorArtifact(artifact({ generatedAt: new Date(NOW + 60_000).toISOString() }), NOW);
    expect(v.available).toBe(true);
  });

  it('rejects an arbitrary status', () => rejects(artifact({ status: 'fine' }), /unrecognised kb-doctor status/));
  it('rejects a non-boolean complete', () => rejects(artifact({ complete: 'yes' }), /complete is not a boolean/));

  it('rejects negative or non-integer counts', () => {
    rejects(artifact({ counts: { ok: 0, drift: -1, unknown: 0 } }), /non-negative integers/);
    rejects(artifact({ counts: { ok: 0, drift: '3', unknown: 0 } }), /non-negative integers/);
    rejects(artifact({ counts: { ok: 0, drift: 1.5, unknown: 0 } }), /non-negative integers/);
  });

  it('rejects counts.drift:0 beside a NON-EMPTY drift array — the false zero itself', () => {
    // This is the exact document the structured artifact was introduced to make
    // impossible, and which validating only `schema` let straight through: the tally
    // says nothing to see, the list says otherwise, and the panel showed the tally.
    rejects(
      artifact({ status: 'drift', counts: { ok: 0, drift: 0, unknown: 0 }, drift: ['tasks: a real difference'] }),
      /counts disagree with their arrays/,
    );
  });

  it('rejects a status that contradicts its own findings', () => {
    rejects(
      artifact({ status: 'clean', counts: { ok: 0, drift: 1, unknown: 0 }, drift: ['tasks: a'] }),
      /contradicts its findings/,
    );
  });

  it('rejects complete:true beside unknown findings', () => {
    rejects(
      artifact({ status: 'unknown', complete: true, counts: { ok: 0, drift: 0, unknown: 1 }, unknown: ['tasks: x'] }),
      /contradicts 1 unknown finding/,
    );
  });

  it('rejects non-string arrays', () => {
    rejects(
      artifact({ status: 'drift', counts: { ok: 0, drift: 1, unknown: 0 }, drift: [{ a: 1 }] }),
      /arrays of strings/,
    );
  });

  it('kbDoctorUnavailable always carries a reason and never a count', () => {
    const v = kbDoctorUnavailable('no drift report');
    expect(v.available).toBe(false);
    expect(v.driftCount).toBeNull();
    expect(v.reason).toBe('no drift report');
  });
});

describe('kb-doctor artifact — the producer/consumer contract', () => {
  it('accepts a document the real producer actually wrote', () => {
    // Shared fixture: verbatim output of scripts/kb-doctor.py. If the producer's shape
    // drifts from what this consumer accepts, this is what fails — rather than the
    // panel quietly going unavailable in production.
    const raw = JSON.parse(readFileSync(path.join(import.meta.dirname, 'fixtures/kb-doctor.schema1.json'), 'utf-8'));
    const v = readKbDoctorArtifact(raw, Date.parse('2026-08-10T08:00:00Z'));
    expect(v.available).toBe(true);
    expect(v.status).toBe('unknown');
    expect(v.complete).toBe(false);
    expect(v.unknownCount).toBe(3);
    expect(v.driftCount).toBe(0);
    expect(v.reason).toBeNull();
  });

  it('accepts the producer’s +00:00 offset, not just Z', () => {
    // The producer writes datetime.now(timezone.utc).isoformat(), which ends "+00:00".
    // A validator that demanded a literal "Z" would reject every real artifact.
    const v = readKbDoctorArtifact(artifact({ generatedAt: '2026-08-10T10:00:00+00:00' }), NOW);
    expect(v.available).toBe(true);
  });
});
