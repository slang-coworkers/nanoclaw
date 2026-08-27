/**
 * `renderLearning` — the L1 learning-atom template.
 *
 * The old template was `` `# ${title}\n\n${body}\n` ``. `body` is
 * agent-authored markdown and almost always already ends with a newline, so
 * the file ended with a blank line — which `git diff --check` reports as an
 * error at EOF. Because these atoms are the source the wiki builder copies
 * into `sources/`, the extra byte was duplicated across the corpus: ~2,600 of
 * the whitespace diagnostics on the knowledge-base tree trace back here (489
 * of them landed in a single PR, #1099).
 *
 * Every case below is DIRTY under the old template except the one where the
 * agent happened not to terminate its body — verified before this change.
 */
import { describe, expect, it } from 'vitest';

import { renderLearning } from './append-learning.js';

/** What the previous template produced, for the contrast the tests assert. */
const oldTemplate = (title: string, body: string): string => `# ${title}\n\n${body}\n`;

const hasBlankLineAtEof = (s: string): boolean => s.endsWith('\n\n');
const hasTrailingWhitespace = (s: string): boolean => s.split('\n').some((l) => /[ \t]+$/.test(l));

describe('renderLearning', () => {
  it('ends with exactly one newline when the body is already terminated', () => {
    const body = 'Learned a thing.\n';
    // The common case, and the one that produced the bulk of the diagnostics.
    expect(hasBlankLineAtEof(oldTemplate('T', body))).toBe(true);
    expect(hasBlankLineAtEof(renderLearning('T', body))).toBe(false);
    expect(renderLearning('T', body)).toBe('# T\n\nLearned a thing.\n');
  });

  it('ends with exactly one newline when the body is NOT terminated', () => {
    expect(renderLearning('T', 'Learned a thing.')).toBe('# T\n\nLearned a thing.\n');
  });

  it('collapses several trailing blank lines', () => {
    const body = 'Learned a thing.\n\n\n';
    expect(hasBlankLineAtEof(oldTemplate('T', body))).toBe(true);
    expect(renderLearning('T', body)).toBe('# T\n\nLearned a thing.\n');
  });

  it('strips trailing whitespace from interior lines', () => {
    const body = 'line one   \nline two\t\n';
    expect(hasTrailingWhitespace(oldTemplate('T', body))).toBe(true);
    expect(hasTrailingWhitespace(renderLearning('T', body))).toBe(false);
    expect(renderLearning('T', body)).toBe('# T\n\nline one\nline two\n');
  });

  it('keeps interior blank lines — only the trailing ones go', () => {
    expect(renderLearning('T', 'para one\n\npara two\n')).toBe('# T\n\npara one\n\npara two\n');
  });

  it('still produces a valid file for an empty body', () => {
    expect(renderLearning('T', '')).toBe('# T\n');
    expect(renderLearning('T', '\n\n')).toBe('# T\n');
  });
});
