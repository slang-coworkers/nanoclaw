import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { linkWorkflowState } from './container-runner.js';

let root: string;
let groupDir: string;
const link = () => path.join(groupDir, '.workflow-state.json');
const session = (name: string) => path.join(root, 'v2-sessions', 'ag-1', name);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'state-link-'));
  groupDir = path.join(root, 'groups', 'g');
  fs.mkdirSync(groupDir, { recursive: true });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('linkWorkflowState', () => {
  it('points the group link at the spawned session', () => {
    linkWorkflowState(groupDir, session('sess-1'));
    expect(fs.readlinkSync(link())).toBe(path.join(session('sess-1'), '.claude', 'workflow-state.json'));
  });

  it('moves the link to a new session, even when the old target still exists', () => {
    fs.mkdirSync(path.join(session('sess-1'), '.claude'), { recursive: true });
    fs.writeFileSync(path.join(session('sess-1'), '.claude', 'workflow-state.json'), '{}');
    linkWorkflowState(groupDir, session('sess-1'));
    linkWorkflowState(groupDir, session('sess-2'));
    expect(fs.readlinkSync(link())).toBe(path.join(session('sess-2'), '.claude', 'workflow-state.json'));
  });

  it('replaces a dangling link and a stale regular file', () => {
    linkWorkflowState(groupDir, session('gone'));
    linkWorkflowState(groupDir, session('sess-3'));
    expect(fs.readlinkSync(link())).toBe(path.join(session('sess-3'), '.claude', 'workflow-state.json'));

    fs.unlinkSync(link());
    fs.writeFileSync(link(), '{"stale":true}');
    linkWorkflowState(groupDir, session('sess-4'));
    expect(fs.lstatSync(link()).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(link())).toBe(path.join(session('sess-4'), '.claude', 'workflow-state.json'));
  });
});
