import { describe, expect, it } from 'vitest';

import { QUIET_FULL_PASS_MS, shouldSkipQuietSession, type QuietSnapshot } from './reconcile-session.js';

// The quiet-session skip is the sweep's answer to the 2026-09-27 prod incident:
// ~2,600 active sessions × ~8 ms of synchronous SQLite per tick blocked the JS
// thread for ~21 s of every minute, which starved the OneCLI spawn timeout and
// GitHub's webhook deadline. These pin the one rule that makes skipping safe:
// a skipped pass can only ever be one that would have found nothing to do.

const now = Date.parse('2026-09-27T12:00:00Z');
const snap = (over: Partial<QuietSnapshot> = {}): QuietSnapshot => ({
  inboundMtimeMs: 1_000,
  outboundMtimeMs: 2_000,
  nextDueAtMs: Number.POSITIVE_INFINITY,
  passAtMs: now - 60_000,
  ...over,
});

describe('shouldSkipQuietSession', () => {
  it('never skips a session the sweep has not fully reconciled yet', () => {
    expect(shouldSkipQuietSession(undefined, 1_000, 2_000, now)).toBe(false);
  });

  it('skips when nothing changed, nothing is scheduled, and the full-pass window is fresh', () => {
    expect(shouldSkipQuietSession(snap(), 1_000, 2_000, now)).toBe(true);
  });

  it('runs the pass when either mailbox file changed', () => {
    // Inbound write (router, CLI response, redrive) …
    expect(shouldSkipQuietSession(snap(), 1_001, 2_000, now)).toBe(false);
    // … or outbound write (container finished a turn, wrote acks).
    expect(shouldSkipQuietSession(snap(), 1_000, 2_001, now)).toBe(false);
  });

  it('runs the pass once a scheduled row comes due, even with no file write', () => {
    // A `process_after` in the future is a timer, not a write: the file will
    // not move when it fires. The snapshot carries the earliest one.
    const due = snap({ nextDueAtMs: now + 5_000 });
    expect(shouldSkipQuietSession(due, 1_000, 2_000, now)).toBe(true);
    expect(shouldSkipQuietSession(due, 1_000, 2_000, now + 5_000)).toBe(false);
    expect(shouldSkipQuietSession(due, 1_000, 2_000, now + 60_000)).toBe(false);
  });

  it('forces a full pass at least every QUIET_FULL_PASS_MS as a safety floor', () => {
    const old = snap({ passAtMs: now - QUIET_FULL_PASS_MS });
    expect(shouldSkipQuietSession(old, 1_000, 2_000, now)).toBe(false);
    const fresh = snap({ passAtMs: now - QUIET_FULL_PASS_MS + 1 });
    expect(shouldSkipQuietSession(fresh, 1_000, 2_000, now)).toBe(true);
  });

  it('never treats a missing mailbox file as quiet', () => {
    // mtime 0 is the "file absent" sentinel — the full pass must see and log it.
    expect(shouldSkipQuietSession(snap({ inboundMtimeMs: 0 }), 0, 2_000, now)).toBe(false);
    expect(shouldSkipQuietSession(snap({ outboundMtimeMs: 0 }), 1_000, 0, now)).toBe(false);
  });
});
