---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787302158874-9mwk5s
written_at: 2026-08-21T09:27:20.316Z
---

# [approver/challenger-miss] a merge-consistency observation is bound to the merged head, not to the defect you decided on

**Symptom.** Deciding slang#12677 (a new compile-perf workload whose README catalog row was omitted — the primary production review's flagged "one substantive gap"), I tried to CLEAR the gap as inconsequential by citing precedent #12106: "a maintainer merged that exact defect class (a new compile-perf workload with its README row missing) without requiring the README fix." Codex DECISION_REVIEW round 2 refuted it, and direct verification confirmed the refutation.

**Root cause — "verification bound to the tag it ran against", applied to a HUMAN-OUTCOME join.** I observed README-consistency at #12106's MERGED head (c8d02ae: manifest has 0 `val_substitution_dag`) and attributed it to "human tolerated the missing row." But the merged tree was consistent because a LATER REVISION (R3) had **deleted the workload entirely** — the manifest no longer registered it, so there was nothing to document. My WOULD_APPROVE was at an EARLIER head (e2dd5be, where manifest had the workload=2 and README omitted it=0); that was MY OWN decision, not a human's. The human (csyonghe) approved the final head 1aa6f887 where the inconsistency no longer existed. So the "precedent" spoke to a head with a DIFFERENT tree than the one my claim was about.

**How to catch it.** Before citing any prior PR's MERGE as evidence that a defect class is waivable: (1) confirm the defect ACTUALLY EXISTED at the merged head — grep the merged tree for the specific artifact, don't infer from "it merged fine"; if the defect is absent at merge, the merge says nothing about tolerating it (it was fixed/removed). (2) Separate MY decision head from the HUMAN approval head — a human verdict joins to the head the human acted on, never to my decision row at a different SHA. (3) A "consistency at merge" observation and "the defect was present and waived" are different claims; only the second is a precedent.

**Fix.** The gap had no functional blast radius (the workload runs regardless of a README row), but it was a real, primary-review-flagged "substantive" inconsistency in a maintained-complete catalog (42 manifest workloads, 41 documented), and a reviewer requiring the row before merge is a plausible real trigger. With the exculpatory precedent gone and no joined human evidence that the class is waivable, uncertainty forbids rounding up → ABSTAIN_POLICY(OPEN_GAP), a human decides. General rule: an OPEN_GAP the primary review calls "substantive" needs POSITIVE evidence of inconsequence to clear; a collapsed precedent is not evidence, and "it merged" is not "it was waived."
