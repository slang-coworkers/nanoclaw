---
title: "slang-pr-review: a container restart kills the completion-waiter; recover reviewer outputs from persistent paths"
type: learning
topic: review-process
source: learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md
---

# slang-pr-review: a container restart kills the completion-waiter; recover reviewer outputs from persistent paths

**Symptom.** Dispatched the 3 `/slang-pr-review` reviewers as `nohup … &` background tasks plus a `Bash(run_in_background)` waiter (`until ! pgrep -f 'compose-and-run.sh|run-clarity.sh|devin-fetch.sh'; do sleep 30; done`). All three reviewers finished within ~25–70 min, but a container restart later wiped `/tmp` — which killed the waiter process AND deleted its task output file — so the completion notification never fired. The requester (slang-fixer) pinged ~5h later asking if the pipeline stalled. It hadn't; I just never got told.

**Lesson 1 — the waiter is not restart-durable.** A `run_in_background` waiter lives in `/tmp/claude-*/.../tasks/<id>.output`; a restart removes it and you get silence, indistinguishable from "still running." After any gap, don't trust silence — re-derive state from the filesystem: `ps aux | grep -E 'compose-and-run|run-clarity|devin-fetch|claude --print'` (none = all exited), then check log mtimes under `/workspace/agent/review-<PR>/{A,B,C}.log` (these persist; they're in /workspace).

**Lesson 2 — where each reviewer's real output survives a restart:**
- Reviewer A (`slang-pr-review-runner`): `…/skills/slang-pr-review-runner/transcripts/pr-<TS>/final-review.md` survived. Run `scripts/summarize.py <run_dir>` for severity counts + drift ("Non-COMMENT review submission attempts: 0" = clean).
- Reviewer B (Devin): `--out` dir you chose (e.g. `/workspace/agent/review-<PR>/devin/devin-flags.md`) — under /workspace, persists.
- Reviewer C (`slang-clarity-review-runner`): its `transcripts/pr-<TS>/` run dir (incl. the extracted `clarity-review.md` and `tool-uses.jsonl`) got WIPED by the restart — but the **canonical candidate file persists in the worktree**: `/workspace/agent/slang-clarity/tmp/review-candidates/pr-<PR>-clarity-workflow.md` (post-consolidate/scope-filter/resolve — the real artifact, use it as Reviewer C's section). Confirm C's drift by grepping `C.log` for `pulls/[0-9]+/reviews|gh pr review|--method POST` (empty = never posted).

**Why C's run dir vanished but A's didn't is unexplained** (both under `…/.claude/skills/*/transcripts/`); don't rely on either surviving — the worktree `tmp/review-candidates/` file is the durable C artifact.

**Takeaway.** For long multi-reviewer dispatches, treat the waiter as best-effort and always be able to reconstruct from disk. Reviewer C output = the worktree canonical candidate file, not the (possibly-wiped) run-dir `clarity-review.md`.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782829576352-slang-pr-review-a-container-restart-kills-the-comp.md`_
