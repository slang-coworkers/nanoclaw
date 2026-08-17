---
title: "[approver/infra] When the PRIMARY review check-run is stuck QUEUED (not the ~6-min posting race), fall to Devin — but only when byte-identical-to-a-reviewed-revision makes it false-safe-free"
type: learning
topic: review-process
source: learnings/1784366403034-approver-infra-when-the-primary-review-check-run-i.md
---

# [approver/infra] When the PRIMARY review check-run is stuck QUEUED (not the ~6-min posting race), fall to Devin — but only when byte-identical-to-a-reviewed-revision makes it false-safe-free

**Symptom:** PR #11471 R2 (`synchronize`, new head `6b66fb1af24e`). Harvest returned exit 10 STALE-only. Per the exit-10 timing-race rule I waited and re-harvested — but the R2 production `review` check-run stayed **`queued` for 23+ minutes and never even transitioned to `in_progress`** (the whole `claude-pr-review.yml` run was `queued`). This is NOT the usual ~6-min "triggered-but-not-yet-posted" race (where the review posts within minutes). It's a GitHub Actions **runner backlog** — the review may not run for a long time, or at all this session.

**Root cause:** The timing-race rule assumes the review is *imminent* (check-run started, posting soon). A check-run stuck in `queued` (never `started`/`in_progress`) is a different failure: the runner hasn't picked up the job. Waiting the prescribed ~6-min window and re-harvesting will keep returning exit 10 indefinitely. Blocking on it forever is its own failure mode; but discarding to Devin-only blindly risks a false-safe if Devin is thin.

**How to catch it / decide:** Distinguish the two states via `gh api repos/<repo>/commits/<sha>/check-runs` — look at the `review` run's `status`:
- `in_progress` (or recently `completed`) → genuine posting race, keep waiting/re-harvesting (the exit-10/exit-22 rule).
- `queued` and NOT advancing across two windows (~20+ min) → runner backlog. Set a firm total budget (I used ~23 min / 2 monitor windows), then fall to the Devin fallback tier **noting the PRIMARY timeout as an infra event**.

**The false-safe guard that makes the fallback safe:** Do NOT fall to fallback casually on a stuck PRIMARY. It is only false-safe-free when you can independently establish the code was already reviewed. For #11471 R2 that held perfectly: the R2 push was a pure master-merge, so both flagged files were **byte-identical to R1** (git blob sha match) — and R1's head-current PRIMARY had already reviewed that exact content and found the 🔴s, which I re-verified present at the R2 head, and Devin R2 completed and corroborated. When the pinned head's *effective PR content* is byte-identical to a revision a PRIMARY already reviewed, the stuck-PRIMARY fallback introduces no new risk. If the code had actually changed, a stuck PRIMARY with only a thin Devin signal should lean ABSTAIN_INFRA (NO_REVIEW_SIGNAL / STALE_STAGE), not a confident BLOCK/APPROVE.

**Fix:** Save the poll transcript (timestamps + check-run status per harvest) as a workspace artifact for auditability — don't rely on live GitHub re-verification later. Record `review_diff_hash = commit:<sha>` (fallback tier has no harvest footer). Relate: [[approver-line-refs-and-paginated-ci]] (check-runs vs combined-status), and the exit-10 re-harvest learning from #11471 R1.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784366403034-approver-infra-when-the-primary-review-check-run-i.md`_
