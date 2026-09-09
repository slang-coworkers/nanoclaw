---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787299482318-1dzuw8
written_at: 2026-09-01T06:13:14.812Z
---

# [approver/human-agreement] merged-unchanged confirms: author_trust-only ABSTAIN on a clean bot fixer PR (human already approved at head) is a pure eligibility deferral, not a miss

**Join outcome (calibration).** shader-slang/slang#12538 MERGED 2026-09-01T06:09:14Z by MEMBER jvepsalainen-nv at head `25dca7204ab5` = my R2 decided head EXACTLY (zero interval commits between decision and merge; mergeCommit 8e57f1ea, reviewDecision APPROVED). Confirms two prior decisions:

1. **R2 ABSTAIN_POLICY/CLAUSE_FAIL:author_trust was correct and healthy.** The abstain was driven ONLY by the eligibility gate (bot author = CONTRIBUTOR, not trusted under policy `v0-shadow`), while the audit-only substance was clean AND a trusted MEMBER had already APPROVED at that head. It merged UNCHANGED. Transferable rule: **an author_trust-only abstain on a clean fixer PR that a trusted human has already approved at head reliably merges unchanged — it is a pure eligibility deferral, NOT a substance signal, and must not be read as an approver miss or "conservative/false" abstain.** ABSTAIN rows are excluded from agreement scoring precisely for this; the merge-unchanged outcome is the expected confirmation, not a disagreement. Do NOT be tempted to round such PRs up to WOULD_APPROVE to "match" the human — the eligibility gate is the whole point, and the human is the intended decider.

2. **R1 WOULD_APPROVE + its over-rejection challenger were vindicated.** The fix (reject builtin-only `Magic/BuiltinType/BuiltinRequirement` modifiers on non-core decls) shipped — identical logic, only rebased onto master + a forced-consistent diagnostic renumber E31228→E31229. It merged with the `isFromCoreModule` shield intact and no over-rejection regression, confirming the R1 probe (all builtin meta modules — core/hlsl/glsl/diff — carry `FromCoreModuleModifier` via `addBuiltinSource`, so only genuine user decls are rejected). The "new reject keyed to isFromCoreModule → enumerate ALL builtin .meta modules, not just core.meta" probe holds up under a real merge.

**Meta-signal:** when the SAME PR is decided across revisions and the verdict flips only because policy resolved differently per-run (R1 v0-shadow-wide WOULD_APPROVE → R2 v0-shadow ABSTAIN), the merge joins to the LATEST decided head; the earlier revision's decision is superseded but its challenger findings still get vindicated if the same fix ships. Score the abstain against "would a human have needed to change it?" — merged-unchanged says no, so the eligibility deferral cost nothing (the human was already in the loop).
