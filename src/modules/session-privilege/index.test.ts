import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  loadApproved,
  mayDeliverInto,
  privilegeForGitHubSender,
  privilegeForSender,
  readPrivilegeSettings,
  rowForPrivilege,
  sessionPrivilegeOf,
  type ClosedCheck2,
  type PrivilegeSettings,
} from './index.js';

let dir: string;
let approvedPath: string;
const enforce = (): PrivilegeSettings => ({ mode: 'enforce', approvedPath });
const off = (): PrivilegeSettings => ({ mode: 'off', approvedPath });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-privilege-'));
  approvedPath = path.join(dir, 'approved.json');
  fs.writeFileSync(approvedPath, JSON.stringify(['github:1001', 'slack:U012AB3CD']));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('loadApproved', () => {
  it('reads namespaced ids and skips anything else', () => {
    fs.writeFileSync(approvedPath, JSON.stringify(['github:1001', 'no-namespace', 42, null, 'slack:U1']));
    expect([...loadApproved(approvedPath)].sort()).toEqual(['github:1001', 'slack:U1']);
  });

  it('is empty for a missing, unreadable or non-array file', () => {
    expect(loadApproved(path.join(dir, 'missing.json')).size).toBe(0);
    fs.writeFileSync(approvedPath, '{not json');
    expect(loadApproved(approvedPath).size).toBe(0);
    fs.writeFileSync(approvedPath, JSON.stringify({ github: ['github:1001'] }));
    expect(loadApproved(approvedPath).size).toBe(0);
  });
});

describe('privilegeForSender', () => {
  it('is closed only for an approved sender, and only when enforcement is on', () => {
    expect(privilegeForSender('github:1001', enforce())).toBe('closed');
    expect(privilegeForSender('slack:U012AB3CD', enforce())).toBe('closed');
    expect(privilegeForSender('github:2002', enforce())).toBe('open');
    expect(privilegeForSender(null, enforce())).toBe('open');
    expect(privilegeForSender('github:1001', off())).toBe('open');
  });

  it('is open for everyone when the approved list is missing', () => {
    fs.rmSync(approvedPath);
    expect(privilegeForSender('github:1001', enforce())).toBe('open');
  });
});

describe('privilegeForGitHubSender', () => {
  it('uses the numeric id of the sender, never the login', () => {
    expect(privilegeForGitHubSender({ sender: { id: 1001, login: 'anyone', type: 'User' } }, enforce())).toBe('closed');
    expect(privilegeForGitHubSender({ sender: { id: 2002, login: 'anyone', type: 'User' } }, enforce())).toBe('open');
    // A string id is not a GitHub id: it is treated as no sender.
    expect(privilegeForGitHubSender({ sender: { id: '1001', type: 'User' } }, enforce())).toBe('open');
    expect(privilegeForGitHubSender({}, enforce())).toBe('open');
  });

  it('gives an automated sender no privilege, even one whose id is on the list', () => {
    expect(privilegeForGitHubSender({ sender: { id: 1001, type: 'Bot' } }, enforce())).toBeUndefined();
  });
});

describe('mayDeliverInto', () => {
  it('refuses only an open session writing into a closed one', () => {
    const open = { privilege: 'open' as const };
    const closed = { privilege: 'closed' as const };
    expect(mayDeliverInto(open, closed)).toBe(false);
    expect(mayDeliverInto(open, open)).toBe(true);
    expect(mayDeliverInto(closed, closed)).toBe(true);
    expect(mayDeliverInto(closed, open)).toBe(true);
  });

  it('counts a session without a privilege as open', () => {
    expect(sessionPrivilegeOf({})).toBe('open');
    expect(sessionPrivilegeOf({ privilege: null })).toBe('open');
    expect(mayDeliverInto({}, { privilege: 'closed' })).toBe(false);
  });
});

describe('rowForPrivilege', () => {
  const row = { model: 'nvidia/zai-org/glm-5.3', weights: 'open' as const };

  it('leaves the row alone when enforcement is off', () => {
    expect(rowForPrivilege(row, 'closed', off())).toBe(row);
    expect(rowForPrivilege(row, 'open', off())).toBe(row);
  });

  it('runs an open session under weights=open, and a closed session without the rule', () => {
    expect(rowForPrivilege({ model: 'x' }, 'open', enforce())).toEqual({ model: 'x', weights: 'open' });
    // `any`, not empty: an empty value would follow the install default, which may be open.
    expect(rowForPrivilege(row, 'closed', enforce())).toEqual({ model: 'nvidia/zai-org/glm-5.3', weights: 'any' });
  });
});

describe('Check 2 on the closed path', () => {
  let evidencePath: string;
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
  const person = (over: Record<string, unknown> = {}) => ({
    identity: 'verified',
    entity: 'verified',
    location: { state: 'verified', checkedAt: hoursAgo(1) },
    ...over,
  });
  const writeEvidence = (people: Record<string, unknown>) => fs.writeFileSync(evidencePath, JSON.stringify({ people }));
  const withCheck2 = (check2: ClosedCheck2): PrivilegeSettings => ({
    mode: 'enforce',
    approvedPath,
    check2,
    eligibilityPath: evidencePath,
  });

  beforeEach(() => {
    evidencePath = path.join(dir, 'eligibility.json');
  });

  it('leaves the approved list alone when the check is off, whatever the file says', () => {
    writeEvidence({ 'github:1001': person({ identity: 'denied' }) });
    expect(privilegeForSender('github:1001', withCheck2('off'))).toBe('closed');
    expect(privilegeForSender('github:1001', enforce())).toBe('closed');
  });

  it('with require, grants a closed session only to an approved person whose evidence is fresh', () => {
    writeEvidence({ 'github:1001': person(), 'slack:U012AB3CD': person(), 'github:2002': person() });
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('closed');
    expect(privilegeForSender('slack:U012AB3CD', withCheck2('require'))).toBe('closed');
    // Fresh evidence without a place on the approved list is not enough.
    expect(privilegeForSender('github:2002', withCheck2('require'))).toBe('open');
  });

  it('with require, an approved person whose location is old, denied or missing gets an open session', () => {
    for (const evidence of [
      person({ location: { state: 'verified', checkedAt: hoursAgo(30) } }),
      person({ location: { state: 'denied' } }),
      person({ location: { state: 'verified' } }),
      person({ entity: 'denied' }),
      person({ identity: 'unknown' }),
    ]) {
      writeEvidence({ 'github:1001': evidence });
      expect(privilegeForSender('github:1001', withCheck2('require')), JSON.stringify(evidence)).toBe('open');
    }
    // Not in the file at all, and no file at all.
    writeEvidence({});
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('open');
    fs.rmSync(evidencePath);
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('open');
  });

  it('a person whose location goes stale asks for an open session at the next message, and a fresh record restores it', () => {
    writeEvidence({ 'github:1001': person({ location: { state: 'verified', checkedAt: hoursAgo(23) } }) });
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('closed');
    writeEvidence({ 'github:1001': person({ location: { state: 'verified', checkedAt: hoursAgo(25) } }) });
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('open');
    writeEvidence({ 'github:1001': person() });
    expect(privilegeForSender('github:1001', withCheck2('require'))).toBe('closed');
  });

  it('with only, Check 2 alone decides, and the approved list is not read', () => {
    writeEvidence({ 'github:2002': person(), 'github:1001': person({ identity: 'unknown' }) });
    expect(privilegeForSender('github:2002', withCheck2('only'))).toBe('closed');
    // On the approved list, but not eligible.
    expect(privilegeForSender('github:1001', withCheck2('only'))).toBe('open');
    fs.rmSync(approvedPath);
    expect(privilegeForSender('github:2002', withCheck2('only'))).toBe('closed');
  });

  it('is open when enforcement is off or the sender is unknown, in every mode', () => {
    writeEvidence({ 'github:1001': person() });
    for (const check2 of ['off', 'require', 'only'] as const) {
      expect(privilegeForSender('github:1001', { ...withCheck2(check2), mode: 'off' })).toBe('open');
      expect(privilegeForSender(null, withCheck2(check2))).toBe('open');
    }
  });

  it('gives an id of an odd shape no closed session, even when the file has a matching key', () => {
    const keys = ['github:NaN', 'github:01', 'github:-1', 'github:1.5', 'github:9007199254740993', 'github:', 'x'];
    writeEvidence(Object.fromEntries(keys.map((k) => [k, person()])));
    fs.writeFileSync(approvedPath, JSON.stringify(keys.filter((k) => /^[a-z-]+:\S+$/.test(k))));
    for (const key of keys) expect(privilegeForSender(key, withCheck2('require')), key).toBe('open');
    expect(privilegeForSender(keys[1]!, withCheck2('only')), keys[1]).toBe('open');
  });

  it('reads the setting, treats a value it does not know as require, and defaults the file path', () => {
    const saved = { ...process.env };
    try {
      delete process.env.NANOCLAW_CLOSED_MODEL_CHECK2;
      delete process.env.NANOCLAW_INPUT_GATE_ELIGIBILITY;
      expect(readPrivilegeSettings().check2).toBe('off');
      expect(readPrivilegeSettings().eligibilityPath).toBe(path.resolve('data/input-gate-eligibility.json'));
      for (const [value, want] of [
        ['off', 'off'],
        ['ONLY', 'only'],
        ['require', 'require'],
        ['on', 'require'],
        ['onyl', 'require'],
      ] as const) {
        process.env.NANOCLAW_CLOSED_MODEL_CHECK2 = value;
        expect(readPrivilegeSettings().check2, value).toBe(want);
      }
      process.env.NANOCLAW_INPUT_GATE_ELIGIBILITY = evidencePath;
      expect(readPrivilegeSettings().eligibilityPath).toBe(evidencePath);
    } finally {
      process.env = saved;
    }
  });
});
