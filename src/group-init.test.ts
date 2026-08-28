import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ensureCleanupPeriodDays, refreshMirror } from './group-init.js';

describe('refreshMirror', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-mirror-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function write(p: string, body: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
  }

  function backdate(p: string, secondsAgo: number): void {
    const t = (Date.now() - secondsAgo * 1000) / 1000;
    fs.utimesSync(p, t, t);
    if (fs.statSync(p).isDirectory()) {
      for (const entry of fs.readdirSync(p)) backdate(path.join(p, entry), secondsAgo);
    }
  }

  it('copies when destination is missing', () => {
    const src = path.join(tmp, 'src', 'foo');
    const dst = path.join(tmp, 'dst', 'foo');
    write(path.join(src, 'SKILL.md'), 'v1');

    expect(refreshMirror(src, dst)).toBe(true);
    expect(fs.readFileSync(path.join(dst, 'SKILL.md'), 'utf8')).toBe('v1');
  });

  it('skips when destination is up-to-date', () => {
    const src = path.join(tmp, 'src', 'foo');
    const dst = path.join(tmp, 'dst', 'foo');
    write(path.join(src, 'SKILL.md'), 'v1');
    fs.cpSync(src, dst, { recursive: true });

    expect(refreshMirror(src, dst)).toBe(false);
  });

  it('refreshes when source is newer', () => {
    const src = path.join(tmp, 'src', 'foo');
    const dst = path.join(tmp, 'dst', 'foo');
    write(path.join(src, 'SKILL.md'), 'v1');
    fs.cpSync(src, dst, { recursive: true });
    backdate(dst, 60);
    write(path.join(src, 'SKILL.md'), 'v2');

    expect(refreshMirror(src, dst)).toBe(true);
    expect(fs.readFileSync(path.join(dst, 'SKILL.md'), 'utf8')).toBe('v2');
  });

  it('removes files deleted from source on refresh', () => {
    const src = path.join(tmp, 'src', 'foo');
    const dst = path.join(tmp, 'dst', 'foo');
    write(path.join(src, 'SKILL.md'), 'v1');
    write(path.join(src, 'stale.md'), 'gone-upstream');
    fs.cpSync(src, dst, { recursive: true });
    backdate(dst, 60);
    fs.rmSync(path.join(src, 'stale.md'));
    write(path.join(src, 'SKILL.md'), 'v2');

    expect(refreshMirror(src, dst)).toBe(true);
    expect(fs.existsSync(path.join(dst, 'stale.md'))).toBe(false);
    expect(fs.readFileSync(path.join(dst, 'SKILL.md'), 'utf8')).toBe('v2');
  });

  it('detects nested file changes', () => {
    const src = path.join(tmp, 'src', 'foo');
    const dst = path.join(tmp, 'dst', 'foo');
    write(path.join(src, 'sub', 'nested.md'), 'v1');
    fs.cpSync(src, dst, { recursive: true });
    backdate(dst, 60);
    write(path.join(src, 'sub', 'nested.md'), 'v2');

    expect(refreshMirror(src, dst)).toBe(true);
    expect(fs.readFileSync(path.join(dst, 'sub', 'nested.md'), 'utf8')).toBe('v2');
  });
});

describe('ensureCleanupPeriodDays', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-settings-'));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  function settingsPath(): string {
    return path.join(tmp, 'settings.json');
  }

  it('adds cleanupPeriodDays=3650 to a pre-existing settings.json that lacks it', () => {
    const file = settingsPath();
    fs.writeFileSync(file, JSON.stringify({ sandbox: { enabled: false } }, null, 2));
    const initialized: string[] = [];

    ensureCleanupPeriodDays(file, initialized);

    const written = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(written.cleanupPeriodDays).toBe(3650);
    expect(written.sandbox).toEqual({ enabled: false }); // preserves existing keys
    expect(initialized).toEqual(['settings.json (cleanupPeriodDays -> 3650)']);
  });

  it('raises a lower existing value (e.g. an explicit 30) up to 3650', () => {
    const file = settingsPath();
    fs.writeFileSync(file, JSON.stringify({ cleanupPeriodDays: 30 }, null, 2));
    const initialized: string[] = [];

    ensureCleanupPeriodDays(file, initialized);

    expect(JSON.parse(fs.readFileSync(file, 'utf8')).cleanupPeriodDays).toBe(3650);
    expect(initialized).toHaveLength(1);
  });

  it('is a no-op when the value is already >= 3650 (idempotent, no rewrite)', () => {
    const file = settingsPath();
    const body = JSON.stringify({ cleanupPeriodDays: 3650 }, null, 2);
    fs.writeFileSync(file, body);
    const before = fs.statSync(file).mtimeMs;
    const initialized: string[] = [];

    ensureCleanupPeriodDays(file, initialized);

    expect(fs.statSync(file).mtimeMs).toBe(before);
    expect(initialized).toEqual([]);
  });

  it('does not throw on malformed JSON — leaves the file untouched', () => {
    const file = settingsPath();
    fs.writeFileSync(file, '{ not valid json');
    const initialized: string[] = [];

    expect(() => ensureCleanupPeriodDays(file, initialized)).not.toThrow();
    expect(fs.readFileSync(file, 'utf8')).toBe('{ not valid json');
    expect(initialized).toEqual([]);
  });

  it('leaves a non-object JSON root (array) untouched and records no bogus success', () => {
    // `[]` is a valid parse but not a valid settings.json. Assigning a key to
    // it would be dropped by stringify, rewriting the file while falsely
    // recording success — guard against that.
    const file = settingsPath();
    fs.writeFileSync(file, '[]');
    const initialized: string[] = [];

    ensureCleanupPeriodDays(file, initialized);

    expect(fs.readFileSync(file, 'utf8')).toBe('[]'); // untouched
    expect(initialized).toEqual([]);
  });

  it('leaves a null/primitive JSON root untouched', () => {
    const file = settingsPath();
    fs.writeFileSync(file, 'null');
    const initialized: string[] = [];

    ensureCleanupPeriodDays(file, initialized);

    expect(fs.readFileSync(file, 'utf8')).toBe('null');
    expect(initialized).toEqual([]);
  });
});
