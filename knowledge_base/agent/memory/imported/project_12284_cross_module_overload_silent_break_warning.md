---
name: project-12284-cross-module-overload-silent-break-warning
description: "slang#12284 cross-module overload silent-break warning — SHIPPED 2026-08-06 as draft PR #12413 (E38208). No isFromCoreModule carve-out (measurement refuted it). OPEN: single-arg ctor T(x) coverage is a maintainer scope call; CI signal pending."
metadata:
  node_type: memory
  type: project
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# slang#12284 — cross-module overload silent-breakage warning (SHIPPED: draft PR #12413)

**Repo:** shader-slang/slang · **Author:** skiminki-nv (MEMBER, self-filed, `Language-Maturity`) · thread `gh-issue-shader-slang/slang-12284`

**Request:** New WARNING. When a call needs implicit conversion and an *imported* module later adds a better-matching exported overload, overload resolution silently rebinds the call to the import — changing semantics with no diagnostic. Classification: feature-request / medium / P2 / frontend (semantic checker — overload resolution).

**Chosen design (skiminki-nv authorized, [comment 5206007242](https://github.com/shader-slang/slang/issues/12284#issuecomment-5206007242)):** Approach **B** — warn when *a same-module (call-site) candidate was silently overridden by an import* (NOT A's ">1 module among candidates"), **ON BY DEFAULT** (opt-in Approach C rejected).

## SHIPPED — draft PR #12413

**https://github.com/shader-slang/slang/pull/12413** · branch `fix/issue-12284` · `Fixes #12284` · label `pr: non-breaking` · state OPEN/DRAFT. Issue 5-bullet posted (a draft PR does not auto-close the issue, so it needs its own footprint).

**Final shape — new `E38208`** (untagged ⇒ always-emitted `default` group). Two helpers straddle the candidate-pruning boundary in `slang-check-overload.cpp`: `noteCandidateFromCallSiteModule` records the best same-module applicable candidate *before* the eager `fastRemoveAt` prune (:2465); `maybeDiagnoseImportedOverloadOverridingLocalCandidate` reports at winner selection (`CompleteOverloadCandidate` :3744).

- **NO `isFromCoreModule` carve-out** — measurement argued *against* it. Under B a plain `lerp(x,y,t)` has no competing candidate in the user's own module so it stays silent by construction; a blanket core-module suppression would silence the genuine hazard (a user's own overload shadowed by a `core.meta.slang`/`hlsl.meta.slang` addition), which is the issue's own motivating case. Verified by controls: positive control fires `warning[E38208]`, three negative controls silent (incl. the stdlib case, confirmed non-vacuously — HLSL really called the import yet 0 warnings).
- **Cost is per-argument, not aggregate.** `conversionCostSum` is a sum (100 args × 900 = 90000 = `kConversionCost_Explicit`) → a threshold on it went silent on exactly the calls the warning exists for. Fixed with `OverloadCandidate::maxArgConversionCost`.
- **The diagnostic names the loser via `CompareOverloadCandidates`**, not first-found — an early version named a function the code never called.
- **Constructor path covered.** `T(x)` (single-arg ctor) never reaches the named-call report site — `ResolveInvoke` routes it early to `_coerce`, which runs its own overload resolution over the target's initializers. Reporting added at `_coerce`'s applicable-unique-winner path, **gated on `outToExpr`** so speculative cost queries (`_coerce` prices conversions constantly without reifying) stay silent.

## Durable source facts (any overload-resolution chain)

- `CompareOverloadCandidates` (`slang-check-overload.cpp:2328`) returns on `conversionCostSum` **before** consulting `getScopeRank` (:2428) — module/lexical proximity is only an equal-cost tie-breaker. ⟹ the imported overload wins on **cost alone**; "but it's in my own module" is never reached. **This is why #12284 must be a DIAGNOSTIC, not a ranking change** — preferring the call-site module would be a silent language-semantics break, far worse than a warning.
- `_coerce` caches conversions on `ImplicitCastMethodKey` (`(fromType,isLValue,toType,constantVal,isConstant)` — no module, no call-site; `slang-check-impl.h:807-844`). The `SharedSemanticsContext` is a **stack local built per-TU** at `checkTranslationUnit` (`slang-check.cpp:184-187`), destroyed per TU ⟹ cross-module leak is structurally impossible. The dedup is per-conversion-shape within a module (consistent with `diagnoseOnce`) — stated positively in the PR, not as a caveat (a caveat invites a reviewer to "fix" sound behavior). ⭐ A type's *name* is not its *lifetime*; for cache scope only the **construction site** establishes it. See [[feedback_a_correction_without_a_coordinate_does_not_stick]].

## OPEN (neither is the fixer's to close)

1. **Single-arg ctor `T(x)` full coverage** is a maintainer scope call. `ResolveInvoke` routes it through `_coerce` under a *temporary* `DiagnosticSink` (`:3510`, `withSink` :3523), returns on success without draining, and the only drain is triple-gated (`IsErrorExpr` :3861 · `getErrorCount()` :3864 · re-emits as `Severity::Error` :3869) — a warning is discarded on all three. Fixing means changing when that sink flushes, altering error reporting for **every** single-arg ctor call. (Disclosed gaps D1 warning-with-failed-compile, D2 explicit generic application, D3 never-executed code, D4 the ctor sink — mostly inside the reporter's stated trigger ⇒ scope questions, not defects.)
2. **CI signal** — draft-dispatch shows all checks `skipping` (run yielded to in-flight human CI). The live retry worker is `ci-retry-yielded-bot.yml`; it correctly defers while human runs are in flight.

**RESUME trigger:** (a) skiminki/maintainer answers the ctor scope either/or → act on it; (b) `slang-reviewer` returns its verdict; (c) CI still all-`skipping` on next check → manual rerun (`gh run rerun` / empty commit). See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].

## Durable lessons (this chain generated them; full statements live in the linked concepts)

- A constraint labelled "mandatory" is mandatory *relative to the design it was reasoned under*; on a design change (A→B) every derived constraint needs re-derivation, not transcription (the carve-out). See [[feedback_mechanism_must_predict_observed_coordinates]].
- A control set proves things only about the input space it *spans*; its silence about an unsampled class is not evidence (all three negative controls were named-function calls, so none could reach the ctor path). Design at least one control that can *refute*, not merely agree.
- A correct argument for rejecting site B is not an argument that site A is complete — enumerate every site that performs the operation.
- Assert `pending == 0` before computing any figure from a running process, and report the sum-check, not the difference (the mid-flight "30 recovered" was `39−9` while retries still ran — 2× overstated). See [[feedback_published_negative_env_claims_need_rederivation]].
- Re-check the *published* copy after patching, never the local file — a measured number outlives the artifact it described and editing prose has no failing test.

Park precedent for skiminki-nv self-filed Language-Maturity issues: [[project_12266_defer_bare_decl_scope_leak_crash]].
