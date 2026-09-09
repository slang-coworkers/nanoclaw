---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788776931144-xkbtcg
written_at: 2026-09-07T14:49:09.825Z
---

# [approver/infra-abstain] Devin partial-render is a devin-fetch.sh limitation on large PRs — prompt-level 'wait' does not fix it; cross-check max line-ref every run

## Symptom
On a second Devin-only run for the same large docs PR (shader-slang/slang#12039
R2, 533 lines), the subagent was explicitly instructed to WAIT for the diff pane
to finish rendering before capturing. `devin-flags.md` STILL carried the
`Loading diffs…` / `This may take a few moments for large PRs` banner, and Devin
STILL reported the populated `:84-88` sections as "empty stubs" (a false claim —
other reviews confirm those sections are full).

## Root cause
The partial capture is a **`devin-fetch.sh` tooling limitation**, not something a
prompt to the subagent can fix: the script snapshots the Devin page before the
GitHub diff-viewer pane finishes loading on large PRs. Prompt-level "please wait"
mitigation is therefore ineffective — the agent cannot force the underlying fetch
to block on the diff pane.

## Also observed (calibration): stale-clean-bot vs. head-current-Devin divergence
Harvest exit 10 gave a STALE production `github-actions[bot]` review verdict
"✅ No bugs found — 1 nit" @ the prior head. But that head predated newly-added
content (`types-fundamental.md` + grown `expressions-conversions.md`), and
head-current Devin flagged 3 new doc-accuracy claims (:249/:250/:271) on exactly
that new content. Lesson: on exit 10 a stale "clean" bot verdict must NOT
reassure — the new commit added lines the bot never saw; that is precisely why
the contract says use head-current Devin and ignore the stale review.

## How to catch it / Fix
- Every Devin-only run: scan `devin-flags.md` for the `Loading diffs…` banner AND
  compare Devin's max cited line-number against the file's real length. R1 saw
  only :6–:88 (badly truncated); R2 reached :249–:271 (mostly loaded) — the
  truncation VARIES run-to-run, so re-check each time, don't assume last run's
  completeness.
- Treat any Devin-only finding on a large PR as low-confidence until verified
  against the actual head diff (`gh pr diff`); where it can't be verified and the
  clauses otherwise pass, ABSTAIN rather than BLOCK.
- Real fix is in tooling: `devin-fetch.sh` should wait for the diff pane to finish
  (poll until the `Loading diffs…` banner clears, or scroll the diff into view)
  before snapshotting. Flag to whoever owns the pr-review-runner skill.
- For #12039 both R1 and R2 it was moot — Step-1 abstained on head_provenance +
  tier_eligible before the verdict mattered — but on a policy-clean Devin-only PR
  this partial capture could drive a spurious BLOCK/REQUEST_CHANGES.
