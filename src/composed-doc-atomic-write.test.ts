/**
 * The composed `CLAUDE.md` is published into a group dir that the agent itself
 * can write, and it is a bind-mount source read at container spawn. A plain
 * `writeFileSync` is therefore two hazards at once:
 *
 *   - a spawn racing the write reads a TRUNCATED document, and
 *     `assertComposedDocUsable` only checks `size > 0`, so a torn file passes
 *     as "usable" and the agent boots on half its instructions;
 *   - a predictable temp path in an agent-writable dir is symlink-plantable,
 *     which is why the temp name must be unguessable rather than
 *     `pid`-and-timestamp.
 *
 * Upstream solved this in `project-doc-compose.ts` (`writeAtomic`); this is that
 * helper, living beside the composed-document marker it pairs with. These tests
 * pin the behaviour and that EVERY writer of the document uses it — the typed
 * spawn path is the one most real groups take, and it was the one an earlier
 * revision of the plan missed.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeComposedDocument } from './group-persona.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-doc-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('writeComposedDocument', () => {
  it('writes the full content', () => {
    const target = path.join(tmp, 'CLAUDE.md');

    writeComposedDocument(target, 'composed body\n');

    expect(fs.readFileSync(target, 'utf-8')).toBe('composed body\n');
  });

  it('replaces an existing document', () => {
    const target = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(target, 'old\n');

    writeComposedDocument(target, 'new\n');

    expect(fs.readFileSync(target, 'utf-8')).toBe('new\n');
  });

  // The point of the exercise: a reader either sees the old document or the new
  // one, never a partial write. Observable via the inode — a fresh one means the
  // bytes were assembled elsewhere and swapped in.
  it('publishes by rename, so the target is never partially written', () => {
    const target = path.join(tmp, 'CLAUDE.md');
    fs.writeFileSync(target, 'old\n');
    const before = fs.statSync(target).ino;

    writeComposedDocument(target, 'x'.repeat(200_000));

    expect(fs.statSync(target).ino).not.toBe(before);
  });

  it('leaves no temp file behind', () => {
    const target = path.join(tmp, 'CLAUDE.md');

    writeComposedDocument(target, 'body\n');

    expect(fs.readdirSync(tmp)).toEqual(['CLAUDE.md']);
  });

  // `wx` fails closed rather than following a pre-planted symlink. Provable by
  // pointing the TARGET's directory at a temp path we do control: write once to
  // learn nothing, then assert the flag's effect directly — a second write to an
  // existing temp path must not clobber it.
  it('creates its temp file exclusively (wx), never truncating an existing path', () => {
    const target = path.join(tmp, 'CLAUDE.md');
    const victim = path.join(tmp, 'victim.txt');
    fs.writeFileSync(victim, 'untouched\n');

    // If the implementation opened its temp path without `wx` AND that path were
    // guessable, this file would be the one it clobbered. We cannot guess the
    // name, so the guarantee is asserted structurally below; here we at least
    // pin that a normal write touches nothing else in the directory.
    writeComposedDocument(target, 'composed\n');

    expect(fs.readFileSync(victim, 'utf-8')).toBe('untouched\n');
    expect(fs.readdirSync(tmp).sort()).toEqual(['CLAUDE.md', 'victim.txt']);
  });
});

/**
 * The symlink-planting guarantee has no honest behavioural test: it holds
 * precisely BECAUSE the temp name is unguessable, so a test cannot plant the
 * name the implementation will choose. Asserting it structurally is the only
 * non-theatrical option — a test that plants `…tmp-<pid>` would pass against a
 * vulnerable implementation too, which is worse than no test.
 */
describe('temp-path hardening (structural — see comment)', () => {
  const source = fs.readFileSync(new URL('./group-persona.ts', import.meta.url), 'utf-8');
  const body = source.slice(source.indexOf('function writeComposedDocument'));
  const fn = body.slice(0, body.indexOf('\n}\n') + 3);

  it('derives the temp name from randomUUID, not pid/timestamp', () => {
    expect(fn).toContain('randomUUID()');
    expect(fn).not.toMatch(/process\.pid|Date\.now\(\)/);
  });

  it('opens the temp file with the exclusive-create flag', () => {
    expect(fn).toContain("flag: 'wx'");
  });
});

describe('both compose paths publish atomically', () => {
  const source = fs.readFileSync(new URL('./container-runner.ts', import.meta.url), 'utf-8');

  // Two write sites: the untyped/legacy path and the typed path. Fixing only one
  // leaves most real groups torn-writable.
  it('never writes the composed document with a bare writeFileSync', () => {
    const bareComposedWrites = source.match(/fs\.writeFileSync\(claudeMdPath/g) ?? [];

    expect(bareComposedWrites).toHaveLength(0);
  });

  it('routes both compose paths through writeComposedDocument', () => {
    const atomicWrites = source.match(/writeComposedDocument\(claudeMdPath/g) ?? [];

    expect(atomicWrites).toHaveLength(2);
  });
});

describe('every writer of the composed document publishes atomically', () => {
  // The spawn path is not the only writer: `npm run rebuild:claude` and the
  // lego migration write the same file, and a spawn racing either one would read
  // a torn document just the same.
  const writers = ['scripts/rebuild-claude-md.ts', 'scripts/migrate-to-lego-templates.ts'];

  it.each(writers)('%s does not write the document with a bare writeFileSync', (rel) => {
    const source = fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf-8');

    expect(source).toContain('writeComposedDocument(');
    expect(source).not.toMatch(/fs\.writeFileSync\((?:filePath|claudeMd)\b/);
  });
});
