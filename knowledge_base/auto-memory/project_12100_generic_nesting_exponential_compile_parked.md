---
name: project_12100_generic_nesting_exponential_compile_parked
description: "#12100 exponential compile time w/ generic nesting depth + >80x regression — PARKED hold-for-assignee (self-assigned reporter owns #12086)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 23ce319d-851b-45f8-a8ca-ea8189e575ec
---

shader-slang/slang#12100 — "Exponential compile time with generic nesting depth; expression-built nested generics regressed >80x since v2026.5". Reporter/assignee: jvepsalainen-nv (NVIDIA CONTRIBUTOR, self-assigned).

**REPRODUCED** by slang-triager on ToT `3eeda847c` (debug). Labeled `reproduced`+`regression`, Type=Performance. Verdict posted to GitHub (comment 4972584693) 2026-07-14.

Two-part perf bug:
1. **Exponential compile (~2-3x/level) in ALL versions** — missing memoization on substitution/conformance path. ResolveInvoke→inferGenericArguments→trySolveGenericArguments→buildSubstDeclRef re-descends the whole `Wrapper<Wrapper<…>>` tree per level; DeclRefType/GenericAppDeclRef substitution uncached, interning pointer-keyed so identical substituted types miss the subtype-witness cache. Fix = high-blast-radius core substitution refactor (Track 1).
2. **>80x v2026.5→v2026.8 regression** — HYPOTHESIS: #9808 autodiff refactor (45ccce9a3, verified in-window) from diff size + commit bodies, NOT a profiled bisect.

Repro (debug): depth 8≈3.1s→12≈11.7s→14≈72s→16 timeout; plain `f(f(…))` → E39997 at ~200 deep. Related shapes (Pair typealias chain, assoc-type chain) exponential back to v2025.14, no recent regression.

**DECISION (Main, 2026-07-14): PARKED — HOLD-for-assignee.** NO fixer dispatched. Mirrors #12096 park for same reporter: self-assigned + owns the #12086 compile-perf workstream this feeds; core-substitution fix too high-blast-radius for independent fixer. Triager kept branch/verdict; re-engage only if assignee opens a PR to review or explicitly asks for help. See [[project_12096...]] pattern, [[feedback_deadpromise_check_assignee_before_rewake]].

Tracking counterpart: #12086 (this reporter's compile-perf sweep PR) carries `generic_nesting`/`generic_nesting_eval`/`interface_depth` microbenchmarks — a fix collapses their top-rung times. See [[project_12086...]].

**UPDATE 2026-07-14 (comment 4972718926, jvepsalainen-nv [Agent] survey):** assignee actively driving — posted follow-up survey with 3 more findings. Chain STAYS parked (their own work). New deltas beyond original memo:
- Balanced-tree `typealias T_i = Pair<T_{i-1}, T_{i-1}>` (DAG, only `depth` unique types) still exponential (depth12=5.9s, depth16 timeout) — cleanest memoization canary; long-standing (not a regression).
- **NEW regression window v2026.12→v2026.13**: conditional conformance via `extension<F,S> Pair<F,S> : IExtra`, calling extension-provided method through depth-16 tower: 0.25s→1.67s→2.28s(master). Mechanism = extension-provided inheritance witness. Repro `cond-16.slang` in the comment.
- **Second ongoing regression post-v2026.13** on inference path: operator-built `Sum<A,B>` chain + the `wrap` repro both ~doubled after v2026.13.
- Clean: value-generic `let N`, built-in `Tuple`, nested init-lists.
Forwarded to triager as record-only (no re-triage, no GitHub post — assignee posts their own). Reviewer picture for eventual PR now includes 3 regression windows, not 1.
