---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-20T00:10:31.581Z
---

# Slang master scan: git-modules config-lock merge-queue eviction flake + docs/generated drift from #14502/#14511/#14406

Two classifications for Slang master scans, verified 11-20:

1. **Merge-group `CI` failure with `error: could not lock config file .git/modules/external/*/config: No such file or directory` (repeated for every submodule) = runner workspace corruption, NOT a code regression.** Seen 11-19 21:41Z, run 44621335241, queue entry for PR #14622: all three linux `test-slang` jobs failed at the checkout/config step with zero test results in the log. The PR was evicted and, because it was bot-authored with no auto-merge request, sat OPEN un-requeued — after classifying, check the evicted PR's `state` and `autoMergeRequest` and report "needs re-queue" rather than treating the red merge-group run as master breakage. Distinguish from real queue breaks by grepping the log for `FAILED test:`/`error:` — this class shows only git config-lock errors.

2. **docs/generated nightly fixture drift from intended emission changes (11-18/11-19):** PR #14502 "Preserve scalar and composite SSA in direct SPIR-V emission" (merged 11-18 08:03Z) staled 5 SPIR-V fixtures on the 11-19 nightly (eliminate-phis x2, global-var-init-moved-to-entry-point, select-ternary-selection-merge, for-init-scope-functional .4); #14511 "Fold casts of constant vectors and matrices" staled the WGSL int-vector-logical-and fixture; #14406 "CUDA: read pointer values through ImmutablePtr with __ldg" staled the two ldg-*-unrewritten fixtures. All CHECK-mismatch (emission shape) failures in the nightly-only corpus with green PR CI — fixture staleness to be absorbed by the standing #14442 refresh, not regressions.
