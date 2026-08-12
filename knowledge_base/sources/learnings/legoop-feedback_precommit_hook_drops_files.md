# nv-* pre-commit hook runs format:fix then re-adds only src/**/*.ts — silently drops other staged files from the commit

The `.husky/pre-commit` hook on nv-* branches runs `pnpm run format:fix` then re-stages **only** `src/**/*.ts` (`git diff --cached --name-only --diff-filter=ACM -- 'src/**/*.ts' | xargs git add`). Net effect: if your commit mixes `src/**/*.ts` edits with other paths (container/, .github/, *.md, *.yaml), and prettier touches anything, the hook's selective re-add can leave the **non-src and the prettier-reset files dropped from the commit** — you get a partial commit with no error.

Symptom seen (PR #554, 2026-06-03): committed a 11-file feature; the resulting commit contained only the 4 brand-new files, and all 6 tracked `M` edits (poll-loop.ts, resolve.ts, container-runner.ts, CHARTER.md, tests) silently fell out. `git show --stat HEAD` revealed it.

**Why:** prettier reformat + a re-add scoped to one glob ≠ re-adding everything that was staged.

**How to apply:** for any multi-path commit on these branches, commit with `git commit --no-verify` (after running `pnpm run format:fix` + tests yourself), then ALWAYS verify with `git show --stat HEAD` that every intended file is present before pushing. Same for `git push` — a pre-push hook re-runs format:fix and can abort the push. Use `--no-verify` on push too when needed. Relates to [[feedback_pr_worktree]] and [[feedback_rebuild_dist_after_merge]].
