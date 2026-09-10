import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  _resetContainerTokenRegistryForTests,
  configureContainerTokenStore,
  hasContainerToken,
  registerContainerToken,
  retainContainerTokens,
  revokeContainerToken,
  updateContainerTokenScope,
} from './mcp-auth-proxy.js';

// Container tokens must outlive the host process: with KillMode=process a
// coworker container survives a host restart and keeps presenting the token it
// was spawned with. These tests simulate the restart by forgetting the
// in-memory registry and asserting the disk mirror brings the token back.

let dir: string;
let file: string;

function readFile(): {
  version: number;
  tokens: Record<string, { groupFolder: string; allowedTools: string[]; containerName?: string }>;
} {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tokens-'));
  file = path.join(dir, 'data', '.mcp-container-tokens.json');
  _resetContainerTokenRegistryForTests();
  configureContainerTokenStore({ path: file });
});

afterEach(() => {
  _resetContainerTokenRegistryForTests();
  configureContainerTokenStore({ path: null });
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('container token persistence', () => {
  it('mirrors registered tokens to a 0600 file and restores them after a "restart"', () => {
    const a = registerContainerToken('group-a', ['mcp__deepwiki__ask_question'], 'nc-x-group-a-1');
    const b = registerContainerToken('group-b', [], 'nc-x-group-b-2');
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const onDisk = readFile();
    expect(onDisk.version).toBe(1);
    expect(Object.keys(onDisk.tokens).sort()).toEqual([a, b].sort());
    expect(onDisk.tokens[a]).toEqual({
      groupFolder: 'group-a',
      allowedTools: ['deepwiki__ask_question'],
      containerName: 'nc-x-group-a-1',
    });

    // Host restart: the Map is gone, the file is not.
    _resetContainerTokenRegistryForTests();
    expect(hasContainerToken(a)).toBe(true);
    expect(hasContainerToken(b)).toBe(true);
  });

  it('retainContainerTokens keeps survivors, prunes the dead, spares legacy tokens without a name', () => {
    const survivor = registerContainerToken('group-a', [], 'nc-x-group-a-1');
    const dead = registerContainerToken('group-a', [], 'nc-x-group-a-9');
    const legacy = registerContainerToken('group-c', []);
    _resetContainerTokenRegistryForTests();

    expect(retainContainerTokens(new Set(['nc-x-group-a-1']))).toBe(1);
    expect(hasContainerToken(survivor)).toBe(true);
    expect(hasContainerToken(dead)).toBe(false);
    expect(hasContainerToken(legacy)).toBe(true);
    // The prune is persisted too.
    expect(Object.keys(readFile().tokens).sort()).toEqual([survivor, legacy].sort());
  });

  it('revoke and re-scope are persisted', () => {
    const a = registerContainerToken('group-a', ['mcp__deepwiki__ask_question'], 'nc-x-group-a-1');
    expect(updateContainerTokenScope('group-a', ['mcp__deepwiki__read_wiki'])).toBe(1);
    expect(readFile().tokens[a].allowedTools).toEqual(['deepwiki__read_wiki']);
    revokeContainerToken(a);
    expect(readFile().tokens[a]).toBeUndefined();
    _resetContainerTokenRegistryForTests();
    expect(hasContainerToken(a)).toBe(false);
  });

  it('a missing or malformed file starts empty instead of throwing', () => {
    expect(hasContainerToken('nope')).toBe(false); // ENOENT path
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{not json');
    _resetContainerTokenRegistryForTests();
    expect(hasContainerToken('nope')).toBe(false);
    fs.writeFileSync(file, JSON.stringify({ version: 2, tokens: {} }));
    _resetContainerTokenRegistryForTests();
    expect(hasContainerToken('nope')).toBe(false);
  });

  it('with the store disabled, tokens stay in memory only and no file is written', () => {
    configureContainerTokenStore({ path: null });
    const a = registerContainerToken('group-a', [], 'nc-x-group-a-1');
    expect(hasContainerToken(a)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });
});
