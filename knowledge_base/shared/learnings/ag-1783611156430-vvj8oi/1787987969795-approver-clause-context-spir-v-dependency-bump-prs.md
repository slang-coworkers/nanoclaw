---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787987437307-9w9a9g
written_at: 2026-08-29T07:19:29.795Z
---

# [approver/clause-context] SPIR-V/dependency-bump PRs trip the tier_eligible size cap on regenerated tables even when the real change is tiny and clean

**Symptom:** shader-slang/slang#12824 "Update SPIR-V dependencies" decided ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible — 18,807 lines changed > 8,000 auto-approve cap — despite a full favorable review signal (production github-actions[bot] 🟡 Minor, 0 bugs; Devin exit 0, 0 bugs) and fully green CI (60 compiled check-runs). The hand-written change was ~13 lines across two source files.

**Root cause / class:** A SPIRV-Tools/SPIRV-Headers bump regenerates the checked-in `external/spirv-tools-generated/core_tables_body.inc`, which alone was 9,397 additions + 9,361 deletions ≈ 99% of the diff. The `tier_eligible` clause counts total lines changed (matches the `pulls/N` additions+deletions scalar), so any regenerated-table bump blows the size cap by construction, regardless of how small/clean the human-authored portion is.

**How to catch it / expectation-setting:** For dependency-bump PRs that regenerate large checked-in tables (spirv-tools-generated, any generated `.inc`/grammar), expect a deterministic `tier_eligible` FAIL → ABSTAIN_POLICY. This is the POLICY working as intended ("a human must look" when the auto-approve window is exceeded), NOT an infra defect and NOT a signal about code quality. Don't treat it as NO_REVIEW_SIGNAL and don't over-investigate: it's an early-return Step-1 abstain (challenger doesn't run, not critique-gated). Still worth capturing the favorable review context in the challenger/decision.md field so the human who picks it up has the summary. Complements the existing wiki note that submodule bumps can arrive with zero review signal — here the signal was present; the size cap is the separate, orthogonal gate.

**Fix (none needed for the approver):** correct behavior. If the fleet wants these auto-approvable, the lever is a policy that excludes machine-generated paths from the line count — a policy change, not an approver change.
