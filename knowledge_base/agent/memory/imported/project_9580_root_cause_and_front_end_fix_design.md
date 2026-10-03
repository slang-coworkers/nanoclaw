---
type: project
name: project_9580_root_cause_and_front_end_fix_design
description: "slang#9580 technical record: why an entry point returning an associated type of an `export` struct crashes GLSL varying legalization (result layout never refreshed after link-time specialization; bisected to PR #8603), why contributor PR #10030's back-end/IR fix was rejected, and the accepted front-end 'sibling approach' in PR #12131 plus its two tracked residuals (#12132, #12134). Split out of project_9580_glsl_legalize_layout_mismatch on 2026-10-03."
metadata:
  node_type: memory
  type: project
---

# #9580 root cause and the accepted front-end fix

Chain state and timeline: [[project_9580_glsl_legalize_layout_mismatch]].

## Mechanism (triager-verified at ToT `d8e8e1a9e`, 2026-07-09)

- **VARIANT 0** (entry point returns an associated type of an `export` struct) →
  `SLANG_ASSERT slang-ir-glsl-legalize.cpp(2166): structTypeLayout` in Debug, segfault in
  `createGLSLGlobalVaryingsImpl` in Release.
- After linking, the return type resolves to the concrete `%ColorOutput`, but the **entry-point
  result layout is never refreshed after link-time specialization**. The concrete struct is paired
  with the stale opaque associated-type layout, so `structTypeLayout` is null.
- **VARIANT 1** (directly-extern return type) works because `slang-parameter-binding.cpp:2739-2749`
  already refreshes it through `lookupExternDeclRefType`. The gap is that an *associated type of*
  an export is not resolved through the export's link-time binding there.
- Bisected to **PR #8603** (symbol-alias link-time types).

## Rejected: contributor PR #10030 (h3r2tic, `fix/link-time-entrypoint-layout`)

An earlier plan to adopt this branch was **reversed**. tangent-vector (CHANGES_REQUESTED) called it
"wrong by construction": it adds layout logic at the IR/back-end level, while layout is an
AST/front-end concern, and reflection must be right too. csyonghe agreed: "a front-end resolution
step before generating the entrypoint layouts." We never edit or close #10030; it stays the
contributor's.

## Accepted: the "sibling approach" (jkwak-work, 2026-07-11)

- A new front-end helper runs **before** both `lookupExternDeclRefType` sites instead of extending
  them in place, so the working VARIANT 1 path is untouched. It reads the export wrapper's
  `InheritanceDecl::witnessVal` and re-resolves the associated type through that concrete witness
  table to `ColorOutput`, with no witness synthesis.
- Plain `resolve()` is not enough: it reads the wrapper's abstract `witnessTable`, not the concrete
  `witnessVal` (fixer's code trace, used to decline codex's "just use resolve()").
- The 07-31 rework (head `ced217320c`) collapsed the duplicated resolve-then-fallback at both
  varying-layout call sites into one bottleneck, `tryResolveAllLinkTimeTypesInDeclRef` (the name
  tangent-vector suggested), and renamed the helper `resolveLinkTimeWrapperMemberType`. Behaviour
  is unchanged.
- tangent-vector's second ask, a comprehensive recursive resolver for every decl-ref shape that
  depends on a link-time parameter, is **preventive, not a live crash**. The fixer's codex-verified
  probes found only two live crashes: the direct case (this PR) and the base-interface case
  (#12134). Generic and nested shapes are clean today. The recursion primitive
  (`substitute`/`resolve`) exists; the missing piece is a hook that injects link-time *type*
  knowledge. The fixer posed the shape and the in-PR-vs-follow-up question on-thread
  (r3687781812, r3687781930) instead of building it speculatively.

## Tracked residuals (both assigned jkwak-work)

- **#12132**: `analyzeMakeStruct` indexes `IRMakeStruct` operands positionally with no bounds check
  (`slang-ir-typeflow-specialize.cpp`). Split out on jkwak's order and kept out of #12131.
- **#12134**: the same crash class when the associated type is declared on a **base** interface
  (needs transitive witness composition). Documented in the PR and filed so the limitation is not
  lost. Without a fix it degrades to the identical pre-existing crash, never a wrong layout.

Tests at `ced217320c`: four `gh-9580-*` tests 8/8 (incl. `-nested`), reflection 41/41, bugs
639/639. The generic test was proven load-bearing by a revert drill.
