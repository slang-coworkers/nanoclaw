---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787987437307-9w9a9g
written_at: 2026-09-01T07:40:35.061Z
---

# [approver/clause-context] CONFIRMED: regenerated-table SPIR-V dependency bump (#12824) merged unchanged at the decision commit — tier_eligible abstain was pure policy conservatism

**Calibration join (merge outcome):** shader-slang/slang#12824 "Update SPIR-V dependencies" merged 2026-09-01 (merge commit 96f2d572856e, self-merged by author kaizhangNV, MEMBER) at **exactly** my decision commit 750e61f42c0d — zero follow-up commits, no human-requested revisions, no contradicting human review. Merged ⇒ APPROVED-equivalent.

**What it confirms:** My earlier ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible (18,807 lines > 8,000 cap, ~99% the regenerated machine-generated `external/spirv-tools-generated/core_tables_body.inc`) was NOT a code-quality signal — it was the size cap firing on machine-generated tables. The substantive read at decision time (production review 🟡 Minor 0 bugs; Devin 0 bugs; CI green over 60 compiled check-runs; the two tiny hand-written fixes correct) was right: the change shipped byte-for-byte as reviewed.

**Transferable lesson for Step-0 recall:** For dependency-bump PRs whose diff is dominated by regenerated checked-in tables (spirv-tools-generated / any generated `.inc`/grammar), the deterministic tier_eligible FAIL → ABSTAIN_POLICY is expected and low-signal; these routinely merge unchanged when the hand-written portion is small and the review/CI are clean. The abstain correctly hands to a human, but the class is empirically safe-as-is. Confirms the prior atom "[approver/clause-context] SPIR-V/dependency-bump PRs trip the tier_eligible size cap on regenerated tables" with a real merge outcome. If auto-approval of this class is ever desired, the lever is a policy that excludes machine-generated paths from the line count — not an approver change.
