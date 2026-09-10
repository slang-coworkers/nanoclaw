---
title: "[approver/clause-gap] Step-1 policy short-circuit abstain must still surface a harvested 🔴 to the human"
type: learning
topic: review-approval
source: learnings/1789021795694-approver-clause-gap-step-1-policy-short-circuit-ab.md
---

# [approver/clause-gap] Step-1 policy short-circuit abstain must still surface a harvested 🔴 to the human

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789021443349-lncfi9
written_at: 2026-09-10T06:29:55.694Z
---

# [approver/clause-gap] Step-1 policy short-circuit abstain must still surface a harvested 🔴 to the human

**Symptom:** On slang#12986 (@fa7aa616d512) the head-current production review (github-actions[bot]) carried Verdict "🔴 Has issues — 1 bug, 2 gaps", yet the decision resolved to ABSTAIN_POLICY because Step-1 clauses failed (no_protected_paths: touches `.github/workflows/**`; ci_green_on_sha: combined status=failure). The 🔴 bug never reached the decision.

**Root cause (correct behavior, easy to under-report):** The skill is strictly sequential — a Step-1 clause FAIL short-circuits to ABSTAIN_POLICY, and Step 3 (challenger) "runs only if Steps 1–2 pass." So a Step-1 policy fail is never overridden by a Step-2 verdict, even a verified-looking 🔴. The ABSTAIN reason_code (CLAUSE_FAIL:no_protected_paths) is correct, but on its own it hides that the harvested review found a real bug — under-informing the human who now must look.

**How to catch it / fix:** When Step-1 short-circuits to ABSTAIN but the harvested review body carries a 🔴 (or high-severity 🟡), do NOT drop that signal. Record it in the `challenger` field (prefixed "CHALLENGER_NOT_RUN: … context for the human: 🔴 @ file:line …") and repeat it in the 5-bullet Verdict line, explicitly labeled "context, not the decision basis." The decision stays ABSTAIN (excluded from agreement scoring, no false-safe risk), but the human report now points at both the policy reason AND the flagged code defect. Cheap, and it prevents a maintainer merging past a 🔴 the pipeline actually saw.

**Bonus signal:** "Cherry-pick slangpy pr N"-titled PRs are not necessarily mechanical — #12986's real substance was a new public `MatrixLayoutMode` enum + IR pass rework + a new `RequiredLoweringPassSet` gate. Read the harvested Changes Overview; don't trust the title to gauge blast radius. (It also legitimately touched `.github/workflows/**` to enable the coordinated breaking-change CI, which is exactly the protected-path predicate firing as designed.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789021795694-approver-clause-gap-step-1-policy-short-circuit-ab.md`_
