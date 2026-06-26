import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { initTestSessionDb, closeSessionDb, getInboundDb } from './db/connection.js';
import {
  buildSystemPromptAddendum,
  getAllDestinations,
  getDestinationsFingerprint,
} from './destinations.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function insertDest(name: string, displayName: string = name): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'channel', 'discord', 'chan', NULL)`,
    )
    .run(name, displayName);
}

describe('destinations fingerprint', () => {
  it('returns the empty string when the table is empty', () => {
    expect(getDestinationsFingerprint()).toBe('');
  });

  it('stays stable across identical reads', () => {
    insertDest('alpha');
    insertDest('beta');
    const a = getDestinationsFingerprint();
    const b = getDestinationsFingerprint();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('changes when a new destination is added', () => {
    insertDest('alpha');
    const before = getDestinationsFingerprint();
    insertDest('beta');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });

  it('changes when a destination is removed', () => {
    insertDest('alpha');
    insertDest('beta');
    const before = getDestinationsFingerprint();
    getInboundDb().prepare('DELETE FROM destinations WHERE name = ?').run('beta');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });

  it('changes when a destination is renamed (display_name)', () => {
    insertDest('alpha', 'Alpha One');
    const before = getDestinationsFingerprint();
    getInboundDb()
      .prepare('UPDATE destinations SET display_name = ? WHERE name = ?')
      .run('Alpha Two', 'alpha');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });
});

describe('buildSystemPromptAddendum reflects live destinations table', () => {
  it('picks up a newly-added destination without process restart', () => {
    insertDest('alpha');
    const first = buildSystemPromptAddendum();
    expect(first).toContain('alpha');
    expect(first).not.toContain('beta');

    insertDest('beta');
    const second = buildSystemPromptAddendum();
    expect(second).toContain('alpha');
    expect(second).toContain('beta');
  });

  it('getAllDestinations returns live rows', () => {
    insertDest('alpha');
    expect(getAllDestinations().map((d) => d.name)).toEqual(['alpha']);
    insertDest('beta');
    expect(getAllDestinations().map((d) => d.name).sort()).toEqual(['alpha', 'beta']);
  });
});
