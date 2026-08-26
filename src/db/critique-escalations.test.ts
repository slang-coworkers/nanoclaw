// Tests for the exactly-once release key and the grant release obligation —
// the two schema-level guarantees behind the consume/stamp interleaving fix.
//
// A release now reaches the host by TWO independent routes: merged into the
// session's escalation file, and appended to the container's
// `critique-releases.jsonl` journal. The journal exists because the escalation
// file can legitimately be gone by the time the gate stamps it. Recording both
// must produce ONE row, and that has to be a property of the schema rather
// than of whichever check-then-act the caller wrote — two sweeps can read the
// same journal line.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createBypassGrant,
  getBypassGrant,
  getEscalationEventsForSession,
  markBypassGrantConsumed,
  markBypassGrantReleaseRecorded,
  recordEscalationEvent,
} from './critique-escalations.js';
import { closeDb, initTestDb } from './connection.js';
import { runMigrations } from './migrations/index.js';

beforeEach(async () => {
  await runMigrations(await initTestDb());
});

afterEach(async () => {
  await closeDb();
});

const SESSION = 'sess-release-key';

function release(dedupeKey: string | null): ReturnType<typeof recordEscalationEvent> {
  return recordEscalationEvent({
    session_id: SESSION,
    agent_group_id: 'ag-1',
    event: 'failed_open',
    reason: 'OUTPUT_REVIEW last verdict is "must-fix"',
    requested_at: 1000,
    dedupe_key: dedupeKey,
  });
}

describe('exactly-once release key', () => {
  it('records the first append and reports the second as a duplicate', async () => {
    expect(await release('failed_open:sess-release-key:rel-1')).toBe('recorded');
    expect(await release('failed_open:sess-release-key:rel-1')).toBe('duplicate');
    const rows = await getEscalationEventsForSession(SESSION);
    expect(rows).toHaveLength(1);
  });

  it('two DIFFERENT releases in one session are both recorded', async () => {
    expect(await release('failed_open:sess-release-key:rel-1')).toBe('recorded');
    expect(await release('failed_open:sess-release-key:rel-2')).toBe('recorded');
    expect(await getEscalationEventsForSession(SESSION)).toHaveLength(2);
  });

  it('unkeyed lifecycle events are unaffected — NULL keys never collide', async () => {
    // The unique index is partial for exactly this reason: self_heal, carded
    // and friends have no natural key and legitimately repeat.
    for (let i = 0; i < 3; i++) {
      expect(await recordEscalationEvent({ session_id: SESSION, event: 'self_heal', attempt: i + 1 })).toBe('recorded');
    }
    expect(await getEscalationEventsForSession(SESSION)).toHaveLength(3);
  });

  it('the key is scoped to its session — the same event id elsewhere still records', async () => {
    expect(await release('failed_open:sess-release-key:rel-1')).toBe('recorded');
    expect(
      await recordEscalationEvent({
        session_id: 'sess-other',
        event: 'failed_open',
        dedupe_key: 'failed_open:sess-other:rel-1',
      }),
    ).toBe('recorded');
    expect(await getEscalationEventsForSession('sess-other')).toHaveLength(1);
  });
});

describe('grant release obligation', () => {
  const GRANT = 'appr-obligation';

  beforeEach(async () => {
    await createBypassGrant({
      grant_id: GRANT,
      session_id: SESSION,
      requested_at: 1000,
      granted_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
      granted_by: 'slack:admin',
    });
  });

  it('a consumed grant carries an OUTSTANDING obligation until the release is recorded', async () => {
    await markBypassGrantConsumed(GRANT, new Date().toISOString());
    const consumed = (await getBypassGrant(GRANT))!;
    expect(consumed.consumed_at).toBeTruthy();
    // Consumption is not completion: the host has not yet seen where the
    // delivery it paid for went, so the escalation file it lands in must stay.
    expect(consumed.release_recorded_at).toBeNull();

    await markBypassGrantReleaseRecorded(GRANT, new Date().toISOString());
    expect((await getBypassGrant(GRANT))!.release_recorded_at).toBeTruthy();
  });

  it('first write wins — ingesting the same release twice keeps the first observation', async () => {
    const first = '2026-08-09T10:00:00.000Z';
    await markBypassGrantReleaseRecorded(GRANT, first);
    await markBypassGrantReleaseRecorded(GRANT, '2026-08-09T11:00:00.000Z');
    expect((await getBypassGrant(GRANT))!.release_recorded_at).toBe(first);
  });

  it('an untouched grant reads as null, not undefined', async () => {
    // `undefined !== null` would read as "already recorded" at the retirement
    // check — the exact early-retirement this column exists to prevent.
    expect((await getBypassGrant(GRANT))!.release_recorded_at).toBeNull();
  });
});
