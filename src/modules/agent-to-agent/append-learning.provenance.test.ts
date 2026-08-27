/**
 * A shared learning says who wrote it.
 *
 * `data/shared/learnings/` is mounted into every container, so one group's
 * write lands in every other group's context — an unauthenticated cross-group
 * channel. The write stays open on purpose (restricting it would break the
 * feature), but it is no longer anonymous: a reader can see who made a claim
 * and weigh it, and an operator can trace one back.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { learningAuthorDir, renderLearning, renderLearningsIndex } from './append-learning.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'learnings-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('renderLearning records provenance in the file', () => {
  it('writes front-matter naming the group and session', () => {
    const out = renderLearning('A thing', 'body text', {
      agentGroupId: 'ag-fixer',
      sessionId: 'sess-1',
      writtenAt: '2026-08-10T00:00:00.000Z',
    });
    expect(out).toMatch(/^---\nauthor_agent_group: ag-fixer\nauthor_session: sess-1\n/);
    expect(out).toContain('written_at: 2026-08-10T00:00:00.000Z');
    expect(out).toContain('# A thing');
  });

  it('still ends with exactly one newline and no trailing whitespace', () => {
    // The pre-existing invariant this file must not regress: these atoms are
    // the L1 source the wiki builder copies, and a stray blank line at EOF is
    // duplicated across the whole knowledge base.
    const out = renderLearning('T', 'body\n', {
      agentGroupId: 'ag',
      sessionId: 's',
      writtenAt: '2026-08-10T00:00:00.000Z',
    });
    expect(out.endsWith('\n')).toBe(true);
    expect(out.endsWith('\n\n')).toBe(false);
  });

  it('omits front-matter when no provenance is given, so old callers are unchanged', () => {
    expect(renderLearning('T', 'body')).toBe('# T\n\nbody\n');
  });
});

describe('learningAuthorDir keeps an agent group id to one safe path segment', () => {
  it('passes through an ordinary group id', () => {
    expect(learningAuthorDir('ag-1a2b3c')).toBe('ag-1a2b3c');
  });

  it('refuses to let a group id escape the learnings directory', () => {
    expect(learningAuthorDir('../../etc')).not.toContain('/');
    expect(learningAuthorDir('../../etc')).not.toContain('..');
    expect(learningAuthorDir('a/b')).not.toContain('/');
  });

  it('never returns an empty segment', () => {
    expect(learningAuthorDir('')).toBe('unknown');
    expect(learningAuthorDir('///')).toBe('unknown');
  });
});

describe('the index shows the author beside every entry', () => {
  it('attributes learnings written under a per-group directory', () => {
    fs.mkdirSync(path.join(dir, 'ag-fixer'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ag-fixer', '1700000000000-a-thing.md'), '# A thing\n');
    const index = renderLearningsIndex(dir);
    expect(index).toContain('[a thing](ag-fixer/1700000000000-a-thing.md) — _ag-fixer_');
  });

  it('still lists flat files written before provenance existed, marked unattributed', () => {
    fs.writeFileSync(path.join(dir, '1600000000000-old-lesson.md'), '# Old lesson\n');
    const index = renderLearningsIndex(dir);
    // Readable at its old path — nothing is moved out from under an existing link.
    expect(index).toContain('[old lesson](1600000000000-old-lesson.md) — _unattributed_');
  });

  it('distinguishes the two rather than blending them', () => {
    fs.mkdirSync(path.join(dir, 'ag-fixer'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'ag-fixer', '1700000000000-new.md'), '# New\n');
    fs.writeFileSync(path.join(dir, '1600000000000-old.md'), '# Old\n');
    const index = renderLearningsIndex(dir);
    expect(index).toMatch(/\[new\]\(ag-fixer\/[^)]+\) — _ag-fixer_/);
    expect(index).toMatch(/\[old\]\([^/)]+\) — _unattributed_/);
  });

  it('ignores INDEX.md itself and any non-markdown file', () => {
    fs.writeFileSync(path.join(dir, 'INDEX.md'), '# Shared Learnings Index\n');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a learning');
    expect(renderLearningsIndex(dir)).toBe('# Shared Learnings Index\n');
  });
});
