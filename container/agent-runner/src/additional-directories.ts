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
 * True for a per-task checkout: a top-level directory named `wt-*`, the naming
 * convention for every checkout made for one issue or review (the supervise-issues
 * worktree GC reaps under it, and the group instructions ask for it).
 *
 * A per-task checkout is a second checkout of a project the group already has a
 * clone of, whether git made it as a linked worktree or as a standalone clone.
 * Consider a reviewer that isolates a review with
 * `git clone --shared slang wt-14452-revA` and runs the review in it. Registering
 * that directory would load slang's `.claude/` and CLAUDE.md once more per review,
 * and the boot refresh would fast-forward it, moving the checkout a review is
 * reading. Neither is wanted for a checkout that exists to pin one PR head.
 */
export function isPerTaskCheckout(dir: string): boolean {
  return path.basename(dir).startsWith('wt-');
}

/**
 * Discover directories to pass to the SDK as `additionalDirectories`:
 *   - every immediate subdir of each non-`cwd` base (host-mounted extras), and
 *   - every immediate subdir of `cwd` that carries its own `.claude/` (a cloned
 *     repo bringing skills/commands/CLAUDE.md), EXCEPT linked git worktrees and
 *     per-task checkouts.
 *
 * The SDK loads each additional directory's `.claude/agents/` and `CLAUDE.md`, and
 * the boot refresh (refresh-clones.ts) fast-forwards every clone in this list.
 * Skipping linked worktrees (see isLinkedGitWorktree) and per-task checkouts (see
 * isPerTaskCheckout) keeps a repo's `.claude/` registered once — the
 * autocompaction-thrash root cause — and keeps the refresh on project clones.
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
        if (isPerTaskCheckout(fullPath)) continue;
      }
      out.push(fullPath);
    }
  }
  return out;
}
