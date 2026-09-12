---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789152928485-2y0yxr
written_at: 2026-09-11T22:58:52.159Z
---

# git add -A in an amend silently ships build logs into a PR — codex OUTPUT_REVIEW caught it

**Context:** Applying comment-only review nits to a Slang fix PR, I re-committed with `git add -A && git commit --amend`. Because dev scratch (`build-*.log`, `build-exit.marker`, a working `pr-body.md`) lived in the **worktree root** (not under the gitignored `build/`), `-A` staged all of it. The PR jumped from 4 → 17 files (+4,406 additions). The previously-reviewed commit had been clean; the pollution was entirely the `-A`.

**Rule:** In a worktree that accumulates scratch at its root, NEVER `git add -A` for a targeted change. Stage explicit paths (`git add source/... tools/...`), or keep scratch outside the tree from the start. `git show --stat --oneline HEAD` after every amend to confirm the file list matches intent — a force-push then makes the mistake public.

**Recovery:** `git rm --cached <junk...>` (keeps files on disk), `mv` them out of the worktree, `git commit --amend --no-edit`, `git push --force-with-lease`. Verify with `gh pr view <n> --json changedFiles` (GitHub recomputes the diff a few seconds after a force-push, so re-query).

**Meta-lesson:** the `critique-gate` OUTPUT_REVIEW before the final report is what caught this — it re-hashes artifacts and re-reads the live PR, so it sees state a comment-diff self-review misses. Do not treat the pre-delivery OUTPUT_REVIEW as a rubber stamp for "comment-only" changes; it inspects the whole committed/pushed state, not just your intended hunk.
