/**
 * The busy-container limit's policy: which running containers count as busy,
 * and the first-come, first-served queue of wakes held at the limit.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_MAX_BUSY_CONTAINERS, parseBusyContainerLimit } from './config.js';
import { BUSY_WINDOW_MS, STARTUP_GRACE_MS, SpawnAdmission, isBusyContainer } from './spawn-admission.js';

const T0 = 1_000_000_000;

describe('isBusyContainer', () => {
  it('counts a spawned container as busy while its heartbeat is inside the window', () => {
    const container = { startedAtMs: T0, adopted: false, heartbeatMs: T0 + 60_000 };
    expect(isBusyContainer(container, T0 + 60_000 + BUSY_WINDOW_MS - 1)).toBe(true);
    expect(isBusyContainer(container, T0 + 60_000 + BUSY_WINDOW_MS)).toBe(false);
  });

  it('counts a spawned container with no heartbeat yet as busy for the startup grace only', () => {
    const container = { startedAtMs: T0, adopted: false, heartbeatMs: 0 };
    expect(isBusyContainer(container, T0 + STARTUP_GRACE_MS - 1)).toBe(true);
    expect(isBusyContainer(container, T0 + STARTUP_GRACE_MS)).toBe(false);
  });

  it("ignores a spawned container's heartbeat from before it started (a previous container's file)", () => {
    const container = { startedAtMs: T0, adopted: false, heartbeatMs: T0 - 1 };
    // Without the gate this fresh container would read as idle the moment it starts.
    expect(isBusyContainer(container, T0 + 1_000)).toBe(true);
  });

  it("trusts an adopted container's older heartbeat: an idle survivor is not busy after a host restart", () => {
    const idle = { startedAtMs: T0, adopted: true, heartbeatMs: T0 - 60 * 60_000 };
    expect(isBusyContainer(idle, T0 + 1_000)).toBe(false);
    const working = { startedAtMs: T0, adopted: true, heartbeatMs: T0 - 1_000 };
    expect(isBusyContainer(working, T0 + 1_000)).toBe(true);
  });
});

describe('SpawnAdmission', () => {
  it('admits while busy containers are under the limit and holds at it', () => {
    const admission = new SpawnAdmission(2);
    expect(admission.admit('a', 0, T0)).toEqual({ admitted: true });
    expect(admission.admit('b', 1, T0)).toEqual({ admitted: true });
    expect(admission.admit('c', 2, T0)).toEqual({ admitted: false, position: 0, firstHold: true });
    expect(admission.held).toBe(1);
  });

  it('serves held sessions first come, first served; a later wake cannot take their slot', () => {
    const admission = new SpawnAdmission(1);
    expect(admission.admit('first', 1, T0).admitted).toBe(false);
    expect(admission.admit('second', 1, T0 + 1).admitted).toBe(false);
    // One slot frees. A brand-new wake and the second-held session both ask before the first does.
    expect(admission.admit('newcomer', 0, T0 + 2)).toEqual({ admitted: false, position: 2, firstHold: true });
    expect(admission.admit('second', 0, T0 + 3)).toEqual({ admitted: false, position: 1, firstHold: false });
    expect(admission.admit('first', 0, T0 + 4)).toEqual({ admitted: true, waitedMs: 4 });
    // Its spawn now counts as busy; the next free slot goes to `second`.
    expect(admission.admit('second', 1, T0 + 5).admitted).toBe(false);
    expect(admission.admit('second', 0, T0 + 6)).toEqual({ admitted: true, waitedMs: 5 });
    expect(admission.admit('newcomer', 0, T0 + 7)).toEqual({ admitted: true, waitedMs: 5 });
    expect(admission.held).toBe(0);
  });

  it('admits as many held sessions as there are free slots', () => {
    const admission = new SpawnAdmission(3);
    for (const id of ['a', 'b', 'c']) expect(admission.admit(id, 3, T0).admitted).toBe(false);
    // Two slots free: positions 0 and 1 may go, position 2 waits.
    expect(admission.admit('b', 1, T0 + 1).admitted).toBe(true);
    expect(admission.admit('c', 2, T0 + 1)).toEqual({ admitted: false, position: 1, firstHold: false });
    expect(admission.admit('a', 2, T0 + 1).admitted).toBe(true);
  });

  it('drops a held session that stops asking, so it cannot hold a slot it no longer wants', () => {
    const admission = new SpawnAdmission(1, 1_000);
    expect(admission.admit('gone', 1, T0).admitted).toBe(false);
    expect(admission.admit('waiting', 1, T0 + 500).admitted).toBe(false);
    // `gone` never asks again. Once its TTL passes, `waiting` is first in line.
    expect(admission.admit('waiting', 0, T0 + 1_200)).toEqual({ admitted: true, waitedMs: 700 });
    expect(admission.held).toBe(0);
  });

  it('keeps a held session that asks again before its TTL', () => {
    const admission = new SpawnAdmission(1, 1_000);
    expect(admission.admit('a', 1, T0).admitted).toBe(false);
    expect(admission.admit('a', 1, T0 + 900).admitted).toBe(false);
    expect(admission.admit('b', 1, T0 + 1_500)).toEqual({ admitted: false, position: 1, firstHold: true });
  });

  it('forget removes a held session from the queue', () => {
    const admission = new SpawnAdmission(1);
    admission.admit('closed', 1, T0);
    admission.forget('closed');
    expect(admission.admit('next', 0, T0 + 1)).toEqual({ admitted: true });
  });

  it('a limit of 0 turns the limit off', () => {
    const admission = new SpawnAdmission(0);
    expect(admission.admit('a', 10_000, T0)).toEqual({ admitted: true });
    expect(admission.held).toBe(0);
  });
});

describe('parseBusyContainerLimit', () => {
  it('reads a whole number of 0 or more, and falls back to the default otherwise', () => {
    expect(parseBusyContainerLimit('48')).toBe(48);
    expect(parseBusyContainerLimit('0')).toBe(0);
    for (const raw of [undefined, '', ' ', '-1', '2.5', 'many']) {
      expect(parseBusyContainerLimit(raw)).toBe(DEFAULT_MAX_BUSY_CONTAINERS);
    }
    expect(DEFAULT_MAX_BUSY_CONTAINERS).toBe(32);
  });
});
