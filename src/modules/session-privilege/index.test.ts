import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  loadApproved,
  mayDeliverInto,
  privilegeForGitHubSender,
  privilegeForSender,
  rowForPrivilege,
  sessionPrivilegeOf,
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
    expect(rowForPrivilege(row, 'closed', enforce())).toEqual({ model: 'nvidia/zai-org/glm-5.3', weights: null });
  });
});
