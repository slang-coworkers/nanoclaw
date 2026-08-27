import fs from 'fs';
import path from 'path';

import { log } from './log.js';

/** Per-group standing instructions prepended to every provider's project document. */
export const PERSONA_PREPEND_FILE = 'instructions.prepend.md';

/**
 * Marker opening every composed group document.
 *
 * `CLAUDE.md` is the *output* of composition — spine fragments, workflows,
 * skills, and `instructions.prepend.md` merged together. `instructions.prepend.md`
 * is one *input* to it. The two are not interchangeable, and feeding a composed
 * document back in as persona compounds it on every spawn.
 *
 * `.claude/skills/migrate-memory/SKILL.md` already keys generated-vs-authored off
 * this marker, so the same string is what the writer must emit.
 */
export const COMPOSED_DOC_MARKER = '<!-- Composed at spawn';

/**
 * True when a document was produced by the composer rather than written by a
 * human. Only the head is inspected: the marker is the first line by contract,
 * and a persona file can legitimately mention it further down.
 */
export function isComposedDocument(content: string): boolean {
  return content.slice(0, 400).includes(COMPOSED_DOC_MARKER);
}

/**
 * Create a group's standing instructions without following or replacing an
 * existing path. Returns false when the content is empty or the path exists.
 */
export function stageGroupPersona(groupDir: string, instructions: string): boolean {
  const content = instructions.trimEnd();
  if (!content.trim()) return false;

  fs.mkdirSync(groupDir, { recursive: true });
  try {
    fs.writeFileSync(path.join(groupDir, PERSONA_PREPEND_FILE), `${content}\n`, { flag: 'wx' });
    return true;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'EEXIST') return false;
    throw err;
  }
}

/** Read a group's standing instructions without following symlinks. */
export function readGroupPersona(groupDir: string): string | null {
  const file = path.join(groupDir, PERSONA_PREPEND_FILE);
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    if (!fs.fstatSync(fd).isFile()) return null;
    const content = fs.readFileSync(fd, 'utf-8').trim();
    return content || null;
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT') return null;
    log.warn('Could not read group standing instructions; omitting persona', {
      file,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}
