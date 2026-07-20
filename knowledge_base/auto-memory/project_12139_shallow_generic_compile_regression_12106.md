---
name: project_12139_shallow_generic_compile_regression_12106
description: "#12139 shallow-generic front-end compile regression from #12106's SubstitutionCache — VERIFIED triage, confound resolved, PARKED-for-maintainer (jvepsalainen-nv self-assigned)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 222f82ce-5ddc-4137-b2a1-452832961b35
---

**#12139** (opened + self-assigned by jvepsalainen-nv, perf-runner maintainer, 07-17): #12106 (Val/type DAG memoization, commit c8d02ae59, merged 07-16) killed #12100's exponential deep-generic compile (`generateIR` −96…−99% on `generic_nesting*`) but added a flat constant-factor tax on SHALLOW generic/checking code — 24/41 tracked workloads ≥2%, net suite +382ms (+2.7%), concentrated in `SemanticChecking` (+8…+48% own) + `apiLoadModule` (+14…+18% own). Even empty compile's core-module checking pays ~8%.

**Root cause (triager-VERIFIED @HEAD 5c30d437f, mechanism ground-truthed from source):** #12106's new `SubstitutionCache` (`slang-ast-substitution.h:66-96`) heap-allocs a fresh `Dictionary` per top-level substitution op + 2 hashes/node. Shared Val DAG (#12100 shape) → linear win; one-shot TREE traversal → ~100% miss = pure overhead. Explains asymmetry: unique/shallow pays, repeated-structure (`module_link`, precompiled-binary) benefits/insulated. **Semantics-preserving** (prior reviewer audits) ⇒ any fix is speed-only, correctness-safe.

**Confound RESOLVED by source (decisive, NOT just deferred):** reporter said `interface_depth`'s +40.1% outlier "not separable" from #12052 vs #12106 in the window `c5d4d76e6..6c837d317`. Triager checked `tools/compile-perf/lib/manifest.py`: `interface_depth`/`generic_nesting`/`generic_nesting_eval` all compile `mode="module"`; #12052 (89443da36) fires ONLY via `IEntryPoint::specialize`/`-specialize` (`EntryPoint::_validateSpecializationArgsImpl`), which among tracked workloads ONLY `rt_renderer_specialize`/`api_specialize` hit. ⇒ `interface_depth` outlier = #12106, NOT #12052. #12052 can only touch the two `-specialize` workloads.

**Recommended fix (for maintainer/perf team):** Approach B = small inline-buffer cache (linear scan, no heap) for shallow/few-node case, promote to Dictionary past threshold — keeps deep-DAG win, removes shallow tax. PROFILE first (`interface_depth` + empty-compile core-module checking) to rank {per-op alloc vs double-hash vs wasted insert}. Revert rejected (re-introduces #12100 blowup).

**Disposition: PARKED-for-maintainer.** jvepsalainen-nv self-assigned; fix most naturally lands as a #12106 optimization by author saipraveenb25 / perf team. Our fixer stood down (no competing PR). Verdict + confound-resolution POSTED to GitHub by Main via REST (triager's OneCLI GitHub was `app_not_connected`): issue #12139 comment 4999864608 (07-17 06:50Z). Related (NOT dup): [[project_12100_generic_nesting_exponential_compile_parked]] (the fix that caused this), sibling compile-perf trackers #12112 [[project_12112_compile_perf_memory_tracking_parked]] / #12113 [[project_12113_minimal_compile_peak_rss_doubled]] (same #12106 era).

**Infra note:** slang-triager's GitHub via OneCLI reported `app_not_connected` this session (could not read issue body / post) while Main's REST worked fine — distinct-looking from the fleet gateway 401 in [[project_github_actions_graphql_401_outage]]; operator may need to reconnect GitHub in OneCLI for slang-triager.
