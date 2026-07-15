---
name: project_12089_hitobject_ser_abi_nvapi_capability
metadata: 
  node_type: memory
  type: project
  originSessionId: edfa7fc6-9dea-4059-a70a-5dcc9b3f8f63
---

**PR #12089** "HitObject: single source-of-truth SER ABI via explicit `nvapi_hit_objects` capability", author **szihs (COLLABORATOR/maintainer)**, opened → ready_for_review 2026-07-14. Body: `Fixes #11903`. NOTE: #11903 + our bot PR #11907 already MERGED/CLOSED 2026-07-10 (see [[project_11903_hitobject_sm69_nvapi_pending]]) — so #12089 is a **maintainer-authored cleaner re-do** of the SER-ABI approach, NOT our chain. Do NOT dispatch fixer/reviewer; `pr_ready` → approver only ([[feedback_webhook_dispatch_by_event]]).

**Mechanism (per approver's read, unverified):** new `nvapi_hit_objects:hlsl_nvapi` capability atom; HLSL type emitter + every HitObject `__target_switch` consult ONE ABI decision via concrete-atom `implies()` on resolved caps; native 2-arg `Invoke` `static_assert`s under NVAPI. Same capability-atom pattern prior chain converged on.

**Approval verdict (2026-07-14, shadow mode, ledger-only, NOTHING posted — [[feedback_approver_never_posts_route_reviewer]]):** **ABSTAIN_POLICY / CHALLENGER_CONCERN** @ head `15ae9279357064990707d80a937fd82b607d0707`. Three human-must-look signals blocked auto-approve:
1. Real build+slang-test CI (ci.yml) **never ran on this head** — only `pull_request_target` jobs green; the 2 new `.slang` tests + core-module ABI change are CI-UNVERIFIED.
2. PR **CONFLICTING / ~228 commits behind master** (diverged, non-mergeable — likely why `pull_request` CI never dispatched).
3. Fallback-tier review only: no production `github-actions[bot]` review (check-run stuck `in_progress` ~48min), Devin timed out (30m); CodeRabbit's one relevant finding = minor test-convention nit (`diag=CHECK` vs `filecheck=CHECK`).

Not BLOCK (no verified bug); not ABSTAIN_INFRA (valid CodeRabbit review harvested, pipeline completed).

**Rev1 next action was: rebase + let CI run. DONE.**

**RE-DECIDED 2026-07-14 ~10:49 on settled head `ce42d01f` (szihs pushed 5 revs in a churn storm: 15ae927→4c26b4d2→0990f618→c83a96d0→ce42d01f; approver re-anchored each push, waited 10-min quiet + real CI complete before parsing; Main forwarded first synchronize + one re-anchor, then went SILENT on the storm per debounce standing-guidance — approver's loop re-polls live head itself).** Verdict: **ABSTAIN_POLICY / CLAUSE_FAIL:ci_green_on_sha** (supersedes rev1 `15ae927` ledger row). Shadow mode — recorded, NOTHING posted.

**Both rev1 policy blockers CLEARED:** PR now MERGEABLE (rebased, no longer ~228 behind) and real `pull_request` CI (ci.yml build+slang-test) dispatched+completed. **But CI is RED** — decisive failure is **PR-caused**: `check-cmdline-ref` failed because new atoms `nvapi_hit_objects` / `cuda_glsl_nvapi_hit_objects` were added but `docs/command-line-slangc-reference.md` NOT regenerated (byte-exact diff gate; approver read the failing job log). `test-falcor` + SlangPy Tests also red (falcor likely external flake). All 9 builds + ~20 test-slang/rhi configs PASSED.

**REAL CODE REGRESSION (approver-independently-verified, would block even if CI green):** `slang-emit-hlsl.cpp:1997` — bare `hlsl_nvapi` + pre-SM6.9 profile now hits `SLANG_UNEXPECTED` (compiler ABORT) instead of a clean diagnostic → regression on a formerly-supported config (the exact edge flagged in rev1 investigation). Production `github-actions[bot]` review now PRIMARY-tier + non-stale (targets ce42d01f): 🔴 1 bug / 3 gaps. Devin ran on this head, no additional bugs.

**Rev2 next action was: regen cmdline-ref + fix SLANG_UNEXPECTED + close gaps. Both hard blockers DONE by rev3.**

**RE-DECIDED 2026-07-14 ~16:47 on rev3 settled head `54a064e9` (single push this time; 10-min quiet + real CI complete + fresh production review posted before parsing).** Verdict: **ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths** (3rd ledger row: rev1 `15ae927` CHALLENGER_CONCERN, rev2 `ce42d01f` ci_green_on_sha, rev3 `54a064e9` no_protected_paths).

**Both rev2 blockers CLEARED (approver code-verified):** (1) `docs/command-line-slangc-reference.md` regenerated → `check-cmdline-ref` passes, combined status GREEN; (2) rev2 🔴 `SLANG_UNEXPECTED` abort FIXED — emitter now emits clean diagnostic **error 55215** + `dx::HitObject` fallback, w/ new regression test using exact `sm_6_5 + hlsl_nvapi` repro.

**NEW rev3 blockers:**
- **Enum driver (protected path):** rev3 adds `source/slang/CMakeLists.txt` (a `slang-fiddle-generate` target for a `--parallel` fiddle race) — policy-protected build path → terminal Step-1 clause fail. Production review itself questions whether this CMake change belongs in a capability PR.
- **NEW verified 🔴 (would BLOCK even if protected-path+CI clean):** on `-profile sm_6_5 -capability hlsl_nvapi`, the `ReorderThread` `__target_switch` selects native `case hlsl:` → emits SM6.9-only `dx::MaybeReorderThread` where pre-PR it emitted `NvReorderThread`. Only the **no-`HitObject`** overload `ReorderThread(uint, uint)` **SILENTLY** regresses (nothing fires the new 55215 diagnostic); the two `HitObject`-taking overloads fail cleanly via 55215. Approver verified in code; CI misses it (no test hits that path); Devin found nothing.

**Next author action (szihs): (1) move the `CMakeLists.txt` fiddle-race fix to a separate PR (or get maintainer sign-off to keep it here); (2) extend the fix to no-`HitObject` `ReorderThread(uint,uint)` — give it the nvapi-vs-native decision or a clean pre-6.9 diagnostic + a `sm_6_5 + hlsl_nvapi` ReorderThread test; (3) close the 3 coverage gaps.** Re-decidable on next `synchronize`. Chain terminal for now; reopens on PR webhook / substantive human comment. Bot posts/flips/merges NOTHING (szihs owns it). `pr-12089-awaiting-join` memory on approver side records human verdict when merge/review join lands.
