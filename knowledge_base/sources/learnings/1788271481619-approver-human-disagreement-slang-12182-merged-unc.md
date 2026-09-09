---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787873078405-moeqgc
written_at: 2026-09-01T14:04:41.619Z
---

# [approver/human-disagreement] slang#12182 merged unchanged after 3 straight abstains — an out-of-contract OPEN_GAP + a comment-hygiene must-fix were both over-conservative vs a domain-expert maintainer

**Outcome (calibration join):** slang#12182 (CUDA/OptiX callable support) was APPROVED by jkwak-work (2026-08-31) and merged (2026-09-01) at commit 3395e9b6 **unchanged** — the exact content I abstained on across three revisions. Human verdict = APPROVED-equivalent; my three rows were all ABSTAIN (excluded from agreement scoring, but a clear over-caution cluster). The maintainer engaged the PR's core `-rdc`/`static`-linkage design deeply (the thread shows the linkage policy "went into a meeting"), so this is a high-confidence signal, not a rubber-stamp.

**What merged unchanged, and the lesson per abstain:**

1. **R1 ABSTAIN:CRITIQUE_MUSTFIX (comment hygiene) → CONFIRMED FALSE ABSTAIN.** The flagged comments (a TODO in the OptiX unit test; comments restating declarations) shipped verbatim. They were never blockers — the production merge-gating review had itself rated them 🔵-advisory. Root cause is a PROCEDURE bug already filed (`[approver/critique-mustfix]`): the DECISION_REVIEW critique re-tiered author-source comment style into a must-fix the approver cannot revise in-role, forcing an abstain. Fix stands: scope DECISION_REVIEW to MY derivation; author comment-style is advisory, never a must-fix that blocks an approve.

2. **R2 ABSTAIN:OPEN_GAP (whole-program `-target ptx` mixing a callable + a non-RT stage folds pipelineType→last entry, dropping `-rdc`) → TOO CONSERVATIVE.** The code merged unaddressed; no gate/diagnostic/test was added. The gap is *reachable* (I probed it) but *out-of-contract*: OptiX pipelines are built with one module per entry point (the PR's own unit test does exactly this), so getEntryPointCount()==1 and the fold is harmless in real usage. My R2 write-up already contained this mitigation — I under-weighted it and abstained anyway. **Transferable rule:** the abstain bar is "would a maintainer BLOCK this," not "does a reachable code path exist." When a challenger-surfaced OPEN_GAP lives only on a path the feature's intended usage model never takes, and a domain-expert reviewer is actively engaged, lean to CLEAR-ADVISORY (note it for the human) rather than ABSTAIN. Reserve OPEN_GAP for gaps reachable in *supported* usage.

3. **R3 ABSTAIN:HARNESS_FAIL (infra, vanished signed policy mount) → correctly excluded**; the merge confirms that under the in-force policy the substantive call was R2's OPEN_GAP.

**Do not overcorrect:** the safe direction is abstain-over-approve, and none of these was reckless (R1 was a forced gate outcome, R2 a genuine reviewer-surfaced path, R3 a real infra defect). The correction is narrow: (a) kill the comment-hygiene→must-fix scope bug; (b) weight intended-usage-model when scoring OPEN_GAP on theoretical paths. Class marker for Step-0 recall on future CUDA/OptiX callable PRs: "mixed whole-program PTX / multi-pipeline-type in one module" is a maintainer-accepted out-of-contract shape, not a blocker.
