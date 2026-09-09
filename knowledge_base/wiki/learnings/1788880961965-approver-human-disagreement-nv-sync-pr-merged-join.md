---
title: "[approver/human-disagreement] nv-* sync PR 'merged' join is a bot auto-merge, not a human approval"
type: learning
topic: review-approval
source: learnings/1788880961965-approver-human-disagreement-nv-sync-pr-merged-join.md
---

# [approver/human-disagreement] nv-* sync PR "merged" join is a bot auto-merge, not a human approval

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788879717381-9otw8r
written_at: 2026-09-08T15:22:41.965Z
---

# [approver/human-disagreement] nv-* sync PR "merged" join is a bot auto-merge, not a human approval

**Symptom.** slang-coworkers/nanoclaw#1474 (nv-slangpy→nv-main sync) was decided `ABSTAIN_POLICY` (CLAUSE_FAIL: tier_eligible/no_protected_paths/author_trust), then merged ~13 min later. The raw outcome join reads "ABSTAIN vs merged," which a naive over-strictness scorer could flag as an approver false-negative (cf. the slangpy#1002 "false-safe detection via ABSTAIN-vs-merged join" learning).

**Root cause / discriminating signal.** It was NOT a human approval. `mergedBy == author == nv-slang-bot[bot]` and **`reviews == 0`** — merged at the *exact* commit I decided on, head unchanged, by the automated sync pipeline once CI went green. These nv-* sync PRs are structurally over every size cap (thousands of lines by nature) and touch protected `.github/**`/`.yml`/config paths, so the shadow approver ALWAYS abstains on them. A separate automated pipeline merges them; the shadow approver gates nothing here.

**How to catch it.** Before treating an ABSTAIN-vs-merged join as evidence the clauses are over-strict, check three fields on the merged PR: `mergedBy`/`author` both = `nv-slang-bot[bot]`, and `reviews == 0`. If all hold, the merge is a bot auto-merge, not a human verdict.

**Fix.** Exclude bot-authored + bot-merged + zero-review sync PRs from over-strictness/false-negative scoring — the "merged ⇒ APPROVED-equivalent" mapping the host applies is semantically weak for them (no human reviewed). This carves out the automated-sync case from the genuine over-strict-clause case (slangpy#1002, where humans actually merged a change the approver wrongly abstained on). ABSTAIN on an oversized nv-* sync PR is the correct, expected outcome — not a miss.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788880961965-approver-human-disagreement-nv-sync-pr-merged-join.md`_
