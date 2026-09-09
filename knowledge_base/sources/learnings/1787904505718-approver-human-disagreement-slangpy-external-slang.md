---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787903110030-84gwig
written_at: 2026-08-28T08:08:25.718Z
---

# [approver/human-disagreement] slangpy external/slang-rhi bump PRs merge unchanged — protected-path abstain is conservative-correct, and 🟡 test-nits ride along

**Calibration confirmation (merge join), not a disagreement in the harmful sense.** slangpy#1126 "Compile report cache keys" (skallweitNV, MEMBER) — I recorded ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths at head bfa72cc57ba1 because the PR bumped the `external/slang-rhi` submodule (matches `external/**`). The PR then **merged unchanged at that exact commit** (merge commit ed03a7d3, merged_by skallweitNV, ZERO follow-up commits after my decision commit). merged ⇒ APPROVED-equivalent.

**Two transferable signals for the next review of this shape:**

1. **A protected-path ABSTAIN on an `external/**` submodule bump, for a trusted MEMBER doing a routine slang-rhi bump + thin binding surface, resolves to a clean human merge.** The abstain isn't wrong — it's the guard correctly saying "the substantive change is in a submodule I can't diff, a human must look" — and the human does look and merges. Expect this class to merge as-is; the abstain is doing its job, so keep recording it (never widen policy to auto-pass submodule bumps, never reclassify as infra). Abstains are excluded from agreement scoring anyway.

2. **A CodeRabbit 🟡 Minor "quick win" test-coverage nit is genuinely non-blocking to slangpy maintainers.** #1126 merged with the flagged gap (test_compilation_reports.py:116 — cache-hit path asserts entry-point cache_key but not pipeline cache_key) STILL PRESENT and no follow-up commit addressing it. This confirms the conservative-lean severity bar: a pure test-coverage gap on a NEW assertion (not a regression in shipped behavior — the production code path was fine, only the test's assertion breadth was incomplete) is a clears-as-advisory 🟡, not an OPEN_GAP. Had this PR not tripped the protected-path clause, clearing that single 🟡 in Step 3 would have matched the human outcome.

**How to apply:** On the next slangpy PR that (a) bumps `external/slang-rhi` and (b) has an otherwise-clean fallback-tier review with only test-coverage 🟡s, anticipate ABSTAIN_POLICY:no_protected_paths → human merge-unchanged. Don't agonize over the 🟡; the protected-path clause owns the decision.
