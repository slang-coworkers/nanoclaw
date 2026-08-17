---
title: "[approver/infra-abstain] Verity delegate-path vs deployed harvest+Devin skill contradiction — the real root of the contract-block gap"
type: learning
topic: review-approval
source: learnings/1784187372743-approver-infra-abstain-verity-delegate-path-vs-dep.md
---

# [approver/infra-abstain] Verity delegate-path vs deployed harvest+Devin skill contradiction — the real root of the contract-block gap

**Builds on** the earlier `[approver/infra-abstain] reviewer-coworker review-doc omits commit_id/_approver_result` atom (slang#12055). That atom named the *symptom* fix ("make the delegate handoff stamp the full block"). This atom records the *deeper* finding after reading all deployed sources on disk.

**Two contradictory pipeline models are simultaneously live in the approver's own instructions:**
- **Deployed `slang-pr-approver/SKILL.md` (synced 2026-07-15) + `/slang-pr-approve` workflow (composed into CLAUDE.md 07-16):** "You build the review input yourself — harvest the bot review + run Devin, then synthesize ONE review doc. **You never dispatch another coworker to review.**" This self-synthesis path DOES stamp `_approver_result:true` + `commit_id = commit_sha` by construction (SKILL.md:26-32, workflow synthesis step, eval-clauses.py:59 note). **No gap on this path.**
- **`.instructions.md` "Verity" overlay (dated 2026-07-09, older):** "You do not review code. The review is done by **slang-reviewer** ... it runs its three-reviewer pipeline and sends the review doc back to you." This delegate path produces slang-reviewer's 3-reviewer doc whose result block omits `_approver_result` + `commit_id` → `commit_match` unevaluable → forced `ABSTAIN_INFRA`.

**Consequence for the "systemic" framing:** the gap does **NOT** "silently recur on every reviewer-coworker-path PR" indefinitely — it only bites when the *delegate* path is taken, and the deployed skill+workflow have **already abandoned that path** in favor of harvest+Devin self-synthesis. #12055 went through the delegate path because the stale overlay still directs it there.

**Two candidate durable fixes (harness-owner's call — outside the lab container's write access; skill lives in external `shader-slang/slang-skills`@main, gh is read-only, local `/home/node/.claude/skills` edits are re-synced away):**
1. **Retire the delegate path** — update the `.instructions.md` Verity overlay to match the deployed harvest+Devin model (which already stamps the block correctly). Root-cause fix; removes the contradiction.
2. **Stamp on the delegate handoff** — if delegation is intentionally retained, slang-reviewer's returned doc must carry `_approver_result:true` + `commit_id = pinned commit_sha`, mirroring the workflow synthesis.

**Lesson:** when a "systemic pipeline bug" is reported, read ALL the deployed instruction sources (composed CLAUDE.md, external SKILL.md, group `.instructions.md` overlay) and diff them — the bug was a stale overlay contradicting a newer skill, not a uniform harness defect. Don't self-modify the overlay on a timestamp inference; confirm the canonical model with the harness owner first.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784187372743-approver-infra-abstain-verity-delegate-path-vs-dep.md`_
