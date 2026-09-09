---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788894920124-bt96v0
written_at: 2026-09-08T19:27:34.799Z
---

# Slang overload notes drop constraint-failed generic candidates by status-pruning (not missing capture) — #12965

shader-slang/slang#12965: when an overload set contains a generic candidate whose interface-conformance constraint is unsatisfied (e.g. conditional conformance `Shape<T> : IShapedCapability`), the multi-candidate "no overload applicable" error (E39999) omits that generic candidate and its constraint, listing only concrete overloads (E40011/E40018). Remove the concrete overloads and the useful E38029 appears.

**Updates the older #12035/#7857 learning** ("generic-constraint rejection reasons are NOT stored per-candidate; only type-coercion is surfaced"). That is now STALE: the failure reason IS captured per-candidate — `OverloadCandidate::genericInferenceFailure` (a `GenericArgumentInferenceFailure` tagged union with `InterfaceConformanceNotSatisfied{subType,supType,location}`), `source/slang/slang-check-impl.h:455` / `:217-373`. The real gap is two-part:
1. **Status-pruning drops it before the note loop.** The candidate is assigned `Status::GenericArgumentInferenceFailed` = enum value 0 = the WORST (`slang-check-impl.h:396-406`). `CompareOverloadCandidates` ranks by status first (`slang-check-overload.cpp:2270-2271`, `int(right->status)-int(left->status)`), so it's strictly worse than concrete arg-mismatch candidates (which reach `FixityChecked`=3) and `AddOverloadCandidateInner` (`:2471-2552`, drop @`:2500-2531`) discards it — it never enters `context.bestCandidates`. Built @`:3112-3123`.
2. **The multi-candidate note loop never reads the reason.** `slang-check-overload.cpp:3603-3641` iterates only `bestCandidates` and emits only signature + `OverloadCandidateArgumentTypeMismatch` (guarded by `argMismatchArgIndex>=0`); it never touches `genericInferenceFailure`. The single-candidate path `CompleteOverloadCandidate` (`~:1510-1613`, E38029 emit `~:1595-1608`) DOES read it — which is exactly why removing the concrete overloads (making the generic the selected candidate) surfaces the useful diagnostic.

Contrast to internalize: EXPLICIT bad call `foo<BadT>(...)` fails later at `TryCheckOverloadCandidateConstraints:1157` → status `DirectionChecked`=5 (better than 3) → NOT dropped. The bug is specific to the IMPLICIT inference-failure path (status demoted to 0).

Recommended fix shape (low risk): retain dropped `GenericArgumentInferenceFailed` generics (arity/shape matched, failed only on a constraint) in a diagnostics-only side list on `OverloadResolveContext`, and extend the note loop to render `genericInferenceFailure` by REUSING `CompleteOverloadCandidate`'s switch. Do NOT raise the candidate status — status is the first SELECTION tiebreak everywhere, high regression surface.

Two meta-lessons: (a) DeepWiki was ACCURATE on the `genericInferenceFailure`/`Status` structure even though a prior grounded learning said otherwise — the codebase had evolved (tagged-union failure-reason mechanism, PR #11571/#11656). Verify against current source rather than trusting an older learning OR blindly trusting DeepWiki; here the source settled it and DeepWiki won. (b) Diagnostics live in `source/slang/slang-diagnostics.lua` (E38029 @`4451`, E39999/E40011/E40018 @`~3998/4034/4055`), NOT the stale `slang-diagnostic-defs.h`. Umbrella issue: #12035.
