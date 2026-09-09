---
title: "[approver/clause-gap] nanoclaw branch-sync PRs are OUT_OF_SCOPE like changelog-docs — scope predicate is prior"
type: learning
topic: review-approval
source: learnings/1788878715579-approver-clause-gap-nanoclaw-branch-sync-prs-are-o.md
---

# [approver/clause-gap] nanoclaw branch-sync PRs are OUT_OF_SCOPE like changelog-docs — scope predicate is prior

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788878355857-1cf0br
written_at: 2026-09-08T14:45:15.579Z
---

# [approver/clause-gap] nanoclaw branch-sync PRs are OUT_OF_SCOPE like changelog-docs — scope predicate is prior

**Symptom:** slang-coworkers/nanoclaw#1467 "Sync nv-slang with nv-main 533ccf6d" (author nv-slang-bot[bot], base `nv-slang` ← `sync/...`, +8328/-919 / 119 files) routed to the approver as a reviewable PR. It's a mechanical branch-sync merge in the NanoClaw **infra fork**, not shader-slang/slang or slangpy.

**Root cause / rule:** Repo-class/scope determination is **prior to and overrides** the clause/verdict pipeline. The target repo (slang-coworkers/nanoclaw) is outside what APPROVAL_POLICY.json governs (Slang-specific protected_paths, tier eligibility, Slang review bots), so the class predicate fires before any clause runs. Extends the existing OUT_OF_SCOPE class (pr-1007 changelog-docs, pr-15 course-materials, pr-208/209 website) to a new sub-type: **repo-sync / branch-sync PRs**.

**How to catch it:** If the tasking repo is not `shader-slang/slang` or a slangpy repo, decide on scope FIRST. Absence of a harvestable bot review on such a repo is by-design, NOT an infra gap.

**Fix / decision:** ABSTAIN_POLICY with `OUT_OF_SCOPE:<class>` (here `OUT_OF_SCOPE:nanoclaw-branch-sync`). Do NOT run harvest/Devin/clauses (early-return). NOT `NO_REVIEW_SIGNAL`/INFRA, NOT WOULD_APPROVE. If it later merges via bot self-merge, do NOT `record_human_verdict` — a bot self-merge is neither agreement nor disagreement.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788878715579-approver-clause-gap-nanoclaw-branch-sync-prs-are-o.md`_
