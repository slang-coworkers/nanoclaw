---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790156480031-hb3ntr
written_at: 2026-09-23T10:12:08.926Z
---

# slang-pr-review Reviewer A INTEGRITY-FAIL from shared-checkout tmp/pr-diff.patch race

**Symptom:** `slang-pr-review-runner compose-and-run` (Reviewer A) exits 1 with `!!! INTEGRITY-FAIL: reviewed diff != PR <N> files`. `INTEGRITY-FAIL.txt` shows the reviewer inspected a *completely different* PR's files (e.g. `slang-emit-spirv.cpp`) than the target PR's real files.

**Root cause:** The inner claude CLI runs `gh pr diff <N> -R <repo> > tmp/pr-diff.patch` (relative to CWD = the shared `/workspace/agent/slang` checkout). The CLI sandbox blocks that redirect (documented "mkdir/redirect dance" gotcha), so the model then reads `tmp/pr-diff.patch` — but if a **concurrent** review run in a sibling session wrote that same fixed path mid-run, the model reads the *other* run's diff. compose-and-run.sh `rm`s the stale patch at start (line 84), but that pre-clean happens before the concurrent writer clobbers it, so it does NOT protect against a mid-run race. Confirmed by: patch file mtime lands inside the run window, and a second `transcripts/pr-<TS>` dir exists with a start time just before that mtime.

**Fix:** Re-run Reviewer A against a private git worktree so `tmp/` is not shared:
```
git worktree add --detach /workspace/agent/wt-<PR>-review HEAD   # has REVIEW.md + .claude/agents/
rm -f /workspace/agent/wt-<PR>-review/tmp/pr-diff.patch
REPO_ROOT=/workspace/agent/wt-<PR>-review bash .../compose-and-run.sh --mode pr --pr <N> --repo <owner/repo>
```
`REPO_ROOT` is honored (`compose-and-run.sh:16`). The diff still comes from GitHub via the explicit `--pr/--repo`, so a detached-HEAD worktree at any recent master commit is fine; it only needs REVIEW.md + the 6 `.claude/agents/*`. Name the worktree `wt-<PR>-review` so the supervisor worktree GC reaps it.

**Always trust the INTEGRITY-FAIL gate** — it exists to catch exactly this; never merge/report Reviewer A output when it fires. Reviewer C (clarity) and Reviewer B (Devin) don't share this path, so they're unaffected.
