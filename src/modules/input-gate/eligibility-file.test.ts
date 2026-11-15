import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../log.js', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { log } from '../../log.js';
import { checkEligibility } from './eligibility.js';
import { eligibilityOfKey, fileEligibilitySources } from './eligibility-file.js';
import type { GateActor } from './types.js';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const actor = (id: number | null): GateActor => ({ id, login: 'someone', type: 'User', association: null });

let dir: string;
let file: string;
const write = (content: unknown) =>
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
const person = (over: Record<string, unknown> = {}) => ({
  identity: 'verified',
  entity: 'verified',
  location: { state: 'verified', checkedAt: hoursAgo(1) },
  ...over,
});
const check = (id: number | null) =>
  checkEligibility(
    actor(id),
    fileEligibilitySources(file, () => NOW),
  );

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elig-'));
  file = path.join(dir, 'eligibility.json');
  vi.mocked(log.warn).mockClear();
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('file eligibility sources', () => {
  it('finds a person with verified evidence eligible', async () => {
    write({ people: { 'github:1234': person() } });
    expect(await check(1234)).toEqual({
      eligible: true,
      identity: 'verified',
      entity: 'verified',
      location: 'verified',
      reason: null,
    });
  });

  it('gives unknown for everyone when the file is missing, as the unconnected sources do', async () => {
    expect(await check(1234)).toMatchObject({ eligible: false, identity: 'unknown', reason: 'not_linked' });
    expect(vi.mocked(log.warn)).not.toHaveBeenCalled();
  });

  it('gives unknown for a person who is not in the file, and for an account without an id', async () => {
    write({ people: { 'github:1234': person() } });
    expect(await check(999)).toMatchObject({ eligible: false, reason: 'not_linked' });
    expect(await check(null)).toMatchObject({ eligible: false, reason: 'not_linked' });
  });

  it('keys people by the numeric id, never by login', async () => {
    write({ people: { 'github:someone': person(), someone: person() } });
    expect(await check(1234)).toMatchObject({ eligible: false });
  });

  it('expires a location older than 24 hours, so the gate reports location_stale', async () => {
    write({ people: { 'github:1': person({ location: { state: 'verified', checkedAt: hoursAgo(25) } }) } });
    expect(await check(1)).toMatchObject({ eligible: false, location: 'expired', reason: 'location_stale' });
  });

  it('lets the file shorten the freshness window, never lengthen it', async () => {
    write({ locationMaxAgeHours: 0.5, people: { 'github:1': person() } });
    expect(await check(1)).toMatchObject({ location: 'expired' });
    write({ locationMaxAgeHours: 2, people: { 'github:1': person() } });
    expect(await check(1)).toMatchObject({ eligible: true });
    // A longer window, a value that overflows to infinity, and a value that is not a positive number: the file is ignored.
    const old = person({ location: { state: 'verified', checkedAt: hoursAgo(25) } });
    for (const hours of [48, 1e308, 0, -1, '24', null]) {
      write({ locationMaxAgeHours: hours, people: { 'github:1': old } });
      expect(await check(1)).toMatchObject({ eligible: false, reason: 'not_linked' });
    }
    expect(vi.mocked(log.warn)).toHaveBeenCalled();
  });

  it('gives unknown for a location time that is missing, malformed or in the future', async () => {
    for (const checkedAt of [undefined, 'yesterday', 12, new Date(NOW + 3_600_000).toISOString()]) {
      write({ people: { 'github:1': person({ location: { state: 'verified', checkedAt } }) } });
      expect(await check(1)).toMatchObject({ eligible: false, location: 'unknown', reason: 'location_unknown' });
    }
  });

  it('takes only a timestamp with an explicit zone and real calendar fields', async () => {
    const bad = [
      '2026-11-14', // a bare date
      '2026-11-14T11:00:00', // no zone: read in the server's zone
      '2026-11-14 11:00:00Z',
      '2026-02-30T11:00:00Z', // no such day
      '2026-11-14T24:00:00Z', // hour 24
      '2026-11-14T11:60:00Z',
      '2026-11-14T11:00:00+24:00',
      '2026-11-14T11:00:00+01:60',
      'Nov 14 2026 11:00 GMT',
    ];
    for (const checkedAt of bad) {
      write({ people: { 'github:1': person({ location: { state: 'verified', checkedAt } }) } });
      expect(await check(1), checkedAt).toMatchObject({ eligible: false, location: 'unknown' });
    }
  });

  it('reads a zone offset and fractional seconds correctly', async () => {
    // Noon UTC is 14:00 at +02:00 and 07:00 at -05:00.
    for (const checkedAt of ['2026-11-14T11:30:00.123Z', '2026-11-14T13:30:00+02:00', '2026-11-14T06:30:00-05:00']) {
      write({ people: { 'github:1': person({ location: { state: 'verified', checkedAt } }) } });
      expect(await check(1), checkedAt).toMatchObject({ eligible: true });
    }
    // The same instant 25 hours earlier is stale, whatever the offset.
    write({
      people: { 'github:1': person({ location: { state: 'verified', checkedAt: '2026-11-13T12:30:00+02:00' } }) },
    });
    expect(await check(1)).toMatchObject({ location: 'expired' });
  });

  it('accepts only a positive safe integer as an id, so no odd value builds a key that matches', async () => {
    const people = Object.fromEntries(
      ['NaN', 'Infinity', '-1', '1.5', '0', '1234'].map((k) => [`github:${k}`, person()]),
    );
    write({ people });
    for (const id of [NaN, Infinity, -1, 1.5, 0, '1234' as unknown as number, 2 ** 60]) {
      expect(await check(id), String(id)).toMatchObject({ eligible: false, reason: 'not_linked' });
    }
    expect(await check(1234)).toMatchObject({ eligible: true });
  });

  it('reads one snapshot for the three sources of a decision, so a file that changes between them cannot mix versions', async () => {
    const sources = fileEligibilitySources(file, () => NOW);
    const who = actor(1);
    // Version 1 verifies only the identity; version 2 only the entity; version 3 only the location.
    write({ people: { 'github:1': { identity: 'verified', entity: 'denied', location: { state: 'denied' } } } });
    const identity = await sources.identity(who);
    write({ people: { 'github:1': { identity: 'denied', entity: 'verified', location: { state: 'denied' } } } });
    const entity = await sources.entity(who);
    write({ people: { 'github:1': { identity: 'denied', entity: 'denied', location: person().location } } });
    const location = await sources.location(who);
    expect([identity, entity, location]).toEqual(['verified', 'denied', 'denied']);
    // A new decision has a new actor object and reads the new file.
    expect(await sources.location(actor(1))).toBe('verified');
  });

  it('passes on the states the file names, and blocks on each of them', async () => {
    write({ people: { 'github:1': person({ identity: 'conflicting' }) } });
    expect(await check(1)).toMatchObject({ eligible: false, reason: 'identity_conflicting' });
    write({ people: { 'github:1': person({ entity: 'denied' }) } });
    expect(await check(1)).toMatchObject({ eligible: false, reason: 'entity_denied' });
    write({ people: { 'github:1': person({ location: { state: 'denied' } }) } });
    expect(await check(1)).toMatchObject({ eligible: false, reason: 'location_denied' });
  });

  it('gives unknown for a state it does not know, and never admits on a typo', async () => {
    write({ people: { 'github:1': person({ identity: 'Verified', entity: true }) } });
    expect(await check(1)).toMatchObject({ eligible: false, identity: 'unknown', entity: 'unknown' });
  });

  it('ignores a file with the wrong shape, warns once, and gives unknown for everyone', async () => {
    for (const bad of ['{not json', '[]', '{"people": []}', '{"people": {}, "locationMaxAgeHours": -1}']) {
      write(bad);
      expect(await check(1)).toMatchObject({ eligible: false, reason: 'not_linked' });
      await check(1);
    }
    expect(vi.mocked(log.warn)).toHaveBeenCalledTimes(4);
  });

  it('reads the file again at each decision, so an edit takes effect at once', async () => {
    write({ people: {} });
    expect(await check(1)).toMatchObject({ eligible: false });
    write({ people: { 'github:1': person() } });
    expect(await check(1)).toMatchObject({ eligible: true });
    write({ people: { 'github:1': person({ identity: 'denied' }) } });
    expect(await check(1)).toMatchObject({ eligible: false, reason: 'identity_denied' });
  });

  it('reads one person by namespaced id at once, for any namespace, with the same verdict as the sources', () => {
    write({ people: { 'github:1234': person(), 'slack:U012AB3CD': person({ entity: 'denied' }) } });
    expect(eligibilityOfKey(file, 'github:1234', () => NOW)).toEqual({
      eligible: true,
      identity: 'verified',
      entity: 'verified',
      location: 'verified',
      reason: null,
    });
    expect(eligibilityOfKey(file, 'slack:U012AB3CD', () => NOW)).toMatchObject({
      eligible: false,
      reason: 'entity_denied',
    });
    expect(eligibilityOfKey(file, 'slack:UNKNOWN', () => NOW)).toMatchObject({ eligible: false, reason: 'not_linked' });
  });

  it('blocks a key of an odd shape, even when the file holds that key', () => {
    const keys = [
      'github:NaN',
      'github:01',
      'github:1.5',
      'github:-1',
      'github:9007199254740993',
      'github:',
      'plain',
      '',
    ];
    write({ people: Object.fromEntries(keys.map((k) => [k, person()])) });
    for (const key of keys)
      expect(
        eligibilityOfKey(file, key, () => NOW),
        key,
      ).toMatchObject({ eligible: false });
  });
});
