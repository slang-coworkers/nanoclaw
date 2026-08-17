---
title: "A dispatched handoff can silently die — verify artifacts exist before relaying 'in progress'; a repeat human ask means your last answer didn't hold"
type: learning
topic: verification
source: learnings/1785825109539-a-dispatched-handoff-can-silently-die-verify-artif.md
---

# A dispatched handoff can silently die — verify artifacts exist before relaying "in progress"; a repeat human ask means your last answer didn't hold

**Context:** shader-slang/slang#11917 epic. Batch-2 (4-pass gating) was dispatched to the fixer 07-28 with a verified-GREEN trace. Batch-3 was dispatched 07-30 01:12 and had PR #12281 open by 03:17 the *same morning* (~2h). Batch-2 produced **nothing in 7 days** — no branch, no PR in any state. The later dispatch overtook the earlier one and completed; the earlier one silently died. The triager kept relaying "fixer building draft PR" because the fixer's last message said so.

**Lesson 1 — a dispatch is not a guarantee of queued work.** There is no delivery receipt that implies progress. Before relaying a downstream status, verify the *artifact*, not the last message: `gh api repos/OWNER/REPO/git/matching-refs/heads/<branch-prefix>` (branch exists? last commit date?) and `gh pr list --search "<n> in:title" --state all`. A branch whose last commit predates the dispatch is not that dispatch's work — check dates, not just names (here `fix/issue-11917-pass2` looked plausibly like "batch 2" but was 07-08, an older slice).

**Lesson 2 — a repeat question from a human is a signal your last answer didn't hold.** When a maintainer asks the same thing twice, do NOT re-relay the previous status. Re-verify first, then answer with the real state — including "our handoff was dropped, I've re-driven it." Dressing 7 days of nothing up as work-in-progress burns the credibility that makes the next status believable.

**Lesson 3 — check whether the stale trace is actually stale before ordering a re-trace.** On re-dispatch, HEAD had moved (15863db48 → 0864e60e6) but every anchor was byte-identical, and `git merge-base --is-ancestor <old> origin/master` confirmed the trace base was still in history. So the restart cost nothing analytically. Verify-then-reuse beats reflexively re-tracing (wasted work) *and* beats blindly reusing (stale line cites).

**Bonus — draft-guardrail audit:** to check whether a bot self-flipped a draft PR, use the timeline event actor, not the current state: `gh api repos/O/R/issues/<n>/timeline --jq '.[] | select(.event=="ready_for_review" or .event=="convert_to_draft") | "\(.event) actor=\(.actor.login) \(.created_at)"'`. Here it returned `pdeayton-nv` — the human flipped it, guardrail intact.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785825109539-a-dispatched-handoff-can-silently-die-verify-artif.md`_
