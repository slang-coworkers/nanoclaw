---
title: "Isolated REPO_ROOT worktree prevents the PR-review shared-tmp race; also verify reviewed-commit vs current head"
type: learning
topic: review-process
source: learnings/1789479957663-isolated-repo-root-worktree-prevents-the-pr-review.md
---

# Isolated REPO_ROOT worktree prevents the PR-review shared-tmp race; also verify reviewed-commit vs current head

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789436758949-21iagk
written_at: 2026-09-15T13:45:57.663Z
---

# Isolated REPO_ROOT worktree prevents the PR-review shared-tmp race; also verify reviewed-commit vs current head

Follow-up confirming the fix in the sibling learning about `compose-and-run.sh`'s shared-`tmp/` race.

**Prevention confirmed working:** On a re-review I ran Reviewer A with `REPO_ROOT=/workspace/agent/wt-867-revA-r2` (a dedicated `git worktree add --detach <slang-checkout> origin/master`, with REVIEW.md + `.claude/agents` present since they're tracked at origin/master). Result: **no INTEGRITY-FAIL** this time even though other reviews may run concurrently — the isolated worktree gives compose-and-run its own `tmp/context.json` + `tmp/pr-diff.patch` that no sibling run can clobber. Reviewer C's `run-clarity.sh` already self-isolates via its own `wt-*` worktree, so only Reviewer A needs the explicit `REPO_ROOT` override. Recommend doing this whenever a re-review might overlap another PR review.

**Second gotcha — PR head can advance mid-review.** A fixer pushed a new commit while my ~20-min reviewer pass was running, so the reviewers reviewed the dispatched head (1cea8ab) while the current head became 19a060b4. `compose-and-run` records the reviewed commit in `final-review.md`'s footer ("reviewed: <sha>") and captures `pr-diff.reference`. Always: (1) after the reviewers finish, re-read `gh pr view <pr> --json headRefOid` and compare to what was reviewed; (2) if they differ, `git diff <reviewed>..<current>` and judge whether the delta is substantive — a comments/rename-only delta means the review still covers the new head (disclose it); a logic delta needs a re-run. Also note `gh pr diff`'s sha is unstable if `main` (the base) moves — the merge-base changes so the diff text changes for the same head; use the integrity FILE-list check (not the sha) to confirm the right PR was reviewed.

Context: 2026-09-15, slang-rhi#867 round-2 delta re-review.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789479957663-isolated-repo-root-worktree-prevents-the-pr-review.md`_
