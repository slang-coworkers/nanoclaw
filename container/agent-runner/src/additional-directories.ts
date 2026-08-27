/**
 * Side-effect-free discovery of directories to pass to the SDK as
 * `additionalDirectories`. Kept out of index.ts (the runtime entrypoint) so it
 * can be imported by tests without booting the poll loop.
 */
import fs from 'fs';
import path from 'path';

/**
 * True only for a **linked git worktree** (`git worktree add`) — the case that
 * causes context thrash: a writer tier accumulates many worktrees of the SAME
 * repo, each carrying an identical `.claude/`, and adding every one re-registers
 * the repo's subagents + re-injects its CLAUDE.md once per worktree, every turn.
 *
 * A linked worktree's `.git` is a FILE whose `gitdir:` points into the parent
 * repo's `.git/worktrees/<name>` administrative dir. We match specifically on
 * that `worktrees/` segment so we do NOT misclassify — and wrongly exclude —
 * other `.git`-is-a-file shapes that are legitimate distinct checkouts:
 *   - submodules:            `gitdir: ../.git/modules/<name>`
 *   - `--separate-git-dir`:  `gitdir: /some/other/path.git`
 * Those are real clones bringing their own skills and must still be included.
 */
export function isLinkedGitWorktree(dir: string): boolean {
  const gitPath = path.join(dir, '.git');
  let st: fs.Stats;
  try {
    st = fs.statSync(gitPath);
  } catch {
    return false; // no .git — not a worktree
  }
  if (!st.isFile()) return false; // real clone (.git is a dir) — not a linked worktree
  let contents: string;
  try {
    contents = fs.readFileSync(gitPath, 'utf8');
  } catch {
    return false; // unreadable — don't exclude on a guess
  }
  const m = /^gitdir:\s*(.+)$/m.exec(contents);
  if (!m) return false;
  // Normalize separators and match the worktree admin path segment. A submodule
  // points at `.git/modules/...`; --separate-git-dir points elsewhere entirely.
  const gitdir = m[1].trim().replace(/\\/g, '/');
  return /(^|\/)\.git\/worktrees\//.test(gitdir);
}

/**
 * Discover directories to pass to the SDK as `additionalDirectories`:
 *   - every immediate subdir of each non-`cwd` base (host-mounted extras), and
 *   - every immediate subdir of `cwd` that carries its own `.claude/` (a cloned
 *     repo bringing skills/commands/CLAUDE.md), EXCEPT linked git worktrees.
 *
 * The SDK loads each additional directory's `.claude/agents/` and `CLAUDE.md`.
 * Skipping linked worktrees (see isLinkedGitWorktree) prevents a repo's `.claude/`
 * being registered once per worktree — the autocompaction-thrash root cause.
 */
export function discoverAdditionalDirectories(bases: string[], cwd: string): string[] {
  const out: string[] = [];
  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base)) {
      const fullPath = path.join(base, entry);
      try {
        if (!fs.statSync(fullPath).isDirectory()) continue;
      } catch {
        continue;
      }
      // For CWD subdirs, only include if they have .claude/ (skills, commands,
      // CLAUDE.md) and are not a linked worktree of a repo already covered.
      if (base === cwd) {
        if (!fs.existsSync(path.join(fullPath, '.claude'))) continue;
        if (isLinkedGitWorktree(fullPath)) continue;
      }
      out.push(fullPath);
    }
  }
  return out;
}
