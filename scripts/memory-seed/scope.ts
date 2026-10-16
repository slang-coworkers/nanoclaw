/**
 * What belongs in a coworker memory seed.
 *
 * One rule, used by export (to select files) and by import (to validate every
 * manifest path), so a seed can neither carry install-local state nor be crafted
 * to write it on the target.
 *
 * The OKF memory tree is portable as a whole bundle: `index.md`, `system/`, every
 * concept folder, loose root notes, and the resources concepts point at (repro
 * sources, patches, drafts). OKF synthesis keeps folding dossiers such as
 * `imported/` into concept files in other folders, so nothing is scoped to one
 * subfolder. Only install-local and transient files stay behind:
 *   - dotfiles and dot-directories — e.g. `.okf-synth-state.json`, the synthesis
 *     convergence log, which describes this install's runs, not the knowledge;
 *   - temp / backup / lock leftovers from interrupted writes and editors
 *     (e.g. `imported/MEMORY.md.tmp`);
 *   - symlinks, which are never followed out of the tree.
 */

export type ExcludeReason = 'dotfile' | 'transient' | 'symlink';

const TRANSIENT_SUFFIXES = ['.tmp', '.swp', '.swo', '~', '.lock', '.bak', '.orig', '.rej'];

/** Why a memory-relative POSIX path stays behind, or null when it belongs in the seed. */
export function excludeReason(rel: string): ExcludeReason | null {
  const parts = rel.split('/');
  if (parts.some((p) => p.startsWith('.'))) return 'dotfile';
  const base = parts[parts.length - 1];
  if (TRANSIENT_SUFFIXES.some((s) => base.endsWith(s))) return 'transient';
  return null;
}

/**
 * A manifest path is safe to write iff it is a relative, normalized POSIX path
 * with no empty/`.`/`..` segment and it is not excluded by the rule above.
 */
export function isSafeSeedPath(rel: unknown): rel is string {
  if (typeof rel !== 'string' || rel === '' || rel.includes('\\') || rel.startsWith('/')) return false;
  if (/^[A-Za-z]:/.test(rel)) return false;
  if (rel.split('/').some((p) => p === '' || p === '.' || p === '..')) return false;
  return excludeReason(rel) === null;
}
