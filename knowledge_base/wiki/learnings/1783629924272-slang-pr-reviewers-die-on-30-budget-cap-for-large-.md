---
title: "Slang PR reviewers die on $30 budget cap for large PRs; shared checkout causes wrong-diff collisions"
type: learning
topic: review-process
source: learnings/1783629924272-slang-pr-reviewers-die-on-30-budget-cap-for-large-.md
---

# Slang PR reviewers die on $30 budget cap for large PRs; shared checkout causes wrong-diff collisions

Two systemic failure modes hit `/slang-pr-review` on a large PR (shader-slang/slang#11615, 40 files, +3490/−1656), 2026-07-09:

**1. `--max-budget-usd 30` is far too low for a big multi-file PR.** Reviewer A (`slang-pr-review-runner compose-and-run`) and BOTH clarity attempts (`slang-clarity-review-runner`) all terminated with `error_max_budget_usd`. Reviewer A had spent ~$63 across 6+ subagents when killed — and crucially it died *before the orchestrator synthesized `final-review.md`*, so the run produced zero merged output despite the subagents doing real work. The per-run guards then fired misleadingly (INTEGRITY-FAIL, "zero subagent dispatches", "0-byte review") — those are downstream artifacts of a mid-flight budget kill, not the real cause. **Action:** for a PR touching >~15 files or >~2k diff lines, pass `--max-budget-usd 120–150`. The default 30 only suits small PRs. Watch the log for `"subtype":"error_max_budget_usd"` — that's the signature.

**2. The shared `/workspace/agent/slang` checkout is clobbered by concurrent PR-review sessions.** Many review sessions run against the same checkout simultaneously (observed tmp debris for #11615, #12020, #11847, #12013, #12029 all at once). The top-level `tmp/context.json` is a single shared file; a concurrent #12029 run overwrote it, and one of #11615's subagents read it and **reviewed the wrong PR (#12029)** — its findings were void. The runner's own `iso-<pr>-review/` dir was correct, but a subagent fell back to the clobbered top-level marker. **Action:** for a re-run, isolate with a git worktree and pass `REPO_ROOT=/path/to/worktree` (the runner honors the env var; `repro.sh` does `cd "$REPO_ROOT"`). `REVIEW.md` + all 6 `.claude/agents/*` are repo-tracked, so `git worktree add --detach <wt> origin/master` inherits them cleanly. This escapes the collision entirely.

**Salvage tip:** when A dies before synthesis, the completed subagents' full reports survive as the `summary`/`result` fields of `task_notification` events in `<run_dir>/stream.jsonl` (the per-subagent `.output` files get cleaned up on session exit, but the notification text persists). On-disk artifacts a subagent wrote (e.g. clarity-candidates.md in the iso dir) also survive until the next concurrent run clobbers them — copy them out immediately. Related: [[clarity-reviewer-fails-when-inner-cli-sandbox-blocks-file-writes]].

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783629924272-slang-pr-reviewers-die-on-30-budget-cap-for-large-.md`_
