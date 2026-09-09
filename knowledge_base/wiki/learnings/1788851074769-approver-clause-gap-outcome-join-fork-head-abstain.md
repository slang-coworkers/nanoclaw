---
title: "[approver/clause-gap] Outcome join: fork-head abstain on slang#12882 merged clean & unchanged — evidence allow_fork_head:false over-abstains for trusted MEMBER authors"
type: learning
topic: review-approval
source: learnings/1788851074769-approver-clause-gap-outcome-join-fork-head-abstain.md
---

# [approver/clause-gap] Outcome join: fork-head abstain on slang#12882 merged clean & unchanged — evidence allow_fork_head:false over-abstains for trusted MEMBER authors

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788371743140-qa0gsk
written_at: 2026-09-08T07:04:34.769Z
---

# [approver/clause-gap] Outcome join: fork-head abstain on slang#12882 merged clean & unchanged — evidence allow_fork_head:false over-abstains for trusted MEMBER authors

**Symptom.** slang#12882 ("Fix bindless binding table enum names") drew 3 consecutive ABSTAIN_POLICY / `CLAUSE_FAIL:head_provenance` decisions (revs 61eee0f8 → fae50be0 → 43ad075b) because it was pushed from a personal fork (`jkiviluoto-nv/slang`) and the bundled `v0-shadow` policy sets `allow_fork_head:false`. On 2026-09-07 the PR **merged** at head `43ad075b` — the exact commit of my rev-3 abstain — by the author (a MEMBER). Merged ⇒ APPROVED-equivalent, so this is an abstain-vs-clean-merge outcome join.

**Root cause / interpretation.** The `head_provenance` predicate was NOT wrong — it correctly detected the fork head, and the policy correctly forbade it. The abstain was procedurally correct. What the outcome join reveals is that the *policy configuration* (`allow_fork_head:false`) is over-strict for this class: a trusted MEMBER author (author_trust clause already PASSED), doc-only change (`docs/user-guide/03-convenience-features.md`, 162 lines/1 file), CI green, merged unchanged. Per the recall concept `slang-a-approver-clause-gaps.md`, the abstain-vs-merged+APPROVED+clean join is "the only instrument that catches a correct-policy but over-strict clause false-negative" — this is a concrete instance.

**How to catch it / Fix.** This is accumulating evidence for the standing operator escalation to mount a policy that sets `allow_fork_head:true` (or gates fork heads on author_trust ∈ trusted set) — NVIDIA MEMBER authors routinely push from personal forks, so the fork-head class overlaps heavily with trusted authors. Do NOT re-escalate the mount per-PR (Core Memory), but DO log each such clean-merge outcome so the evidence base compounds. Note the safety envelope: relaxing fork-head would still leave author_trust + CI + protected-paths + size caps as gates; the abstains it would convert are precisely the MEMBER-authored, CI-green, in-caps PRs. Data point recorded 2026-09-07; merged_by=jkiviluoto-nv, head 43ad075b2e87.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788851074769-approver-clause-gap-outcome-join-fork-head-abstain.md`_
