/**
 * The session-DB boundary must refuse production from a test process.
 *
 * This exists because it already happened: `integration.test.ts` seeds a
 * `discord` / `chan-1` destination, `getOutboundDb()` had no test guard at all,
 * and those fixture rows reached a LIVE session DB — after which the
 * orchestrator tried to redeliver a message to a destination that exists
 * nowhere in the install, every couple of minutes, for hours.
 *
 * A guard whose own test can be deleted without anything going red is not a
 * guard, so this asserts both halves: it blocks, and it stops blocking once
 * `initTestSessionDb()` has been called.
 */
import { afterEach, describe, expect, test } from 'bun:test';

import { closeSessionDb, getInboundDb, getOutboundDb, initTestSessionDb, openInboundDb } from './connection.js';

afterEach(() => {
  closeSessionDb();
});

describe('session DBs refuse production under test', () => {
  test('getOutboundDb throws instead of opening the live file for WRITING', () => {
    closeSessionDb();
    expect(() => getOutboundDb()).toThrow(/Refusing to open the live outbound\.db/);
  });

  test('the inbound paths refuse too — read-only is not a licence to touch production', () => {
    closeSessionDb();
    expect(() => getInboundDb()).toThrow(/Refusing to open the live inbound\.db/);
    expect(() => openInboundDb()).toThrow(/Refusing to open the live inbound\.db/);
  });

  test('initTestSessionDb lifts the guard, so real tests are unaffected', () => {
    initTestSessionDb();
    expect(() => getOutboundDb()).not.toThrow();
    expect(() => getInboundDb()).not.toThrow();
    expect(() => openInboundDb()).not.toThrow();
  });

  test('a closeSessionDb teardown re-arms it — the exact hole that leaked', () => {
    // The original leak needed no misuse: initTestSessionDb() then
    // closeSessionDb() in an afterEach nulled the singletons, and the NEXT
    // getOutboundDb() in the same process silently reopened production.
    initTestSessionDb();
    expect(() => getOutboundDb()).not.toThrow();
    closeSessionDb();
    expect(() => getOutboundDb()).toThrow(/Refusing to open the live outbound\.db/);
  });
});
