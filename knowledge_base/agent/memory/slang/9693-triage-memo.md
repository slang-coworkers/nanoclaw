---
type: triage
---
# Triage: shader-slang/slang#9693 — Vertex attribute locations are reordered only when targeting WGSL
Date: 2026-11-18 | Category: bug | Severity: medium | Priority: P1 | Component: target-emit (WGSL)

## What's broken
1. WGSL-only: for a VSInput struct with POSITION/NORMAL/TEXCOORD0/TEXCOORD1 (declared order), WGSL
   emits `@location` 0,2,3,1 while GLSL/Metal/SPIR-V/HLSL keep declared order 0,1,2,3.
2. `[vk::location(N)]` on semantic-bearing fields is ignored on WGSL, contradicting
   docs/user-guide/a2-03-wgsl-target-specific.md ("[vk::location(N)] ... are respected").
   Semantic-less `[vk::location(N)]` fields ARE respected (control case verified).

## Repro (verified on master 4a1d62c5b with freshly rebuilt slangc)
- `slangc -target wgsl vert.slang` → `@location` (0,2,3,1); `-target glsl` / `-target metal` → 0,1,2,3.
- `slangc -target wgsl vkloc.slang` (vk::location 3/1/0/2 on the four fields) → still 0,2,3,1 (ignored).
- Files kept at /tmp/9693/{vert,vkloc,nosem}.slang.

## Root cause (verified facts, file:line)
- Front end is correct and identical for all targets: `slang-parameter-binding.cpp` assigns
  VertexInput (==VaryingInput, slang.h:2388) offsets in declared order and honors `vk::location`
  (processEntryPointVaryingParameterDecl :2272-2303). Offsets survive into IR (dump-ir offset(5,0..3)).
- WGSL legalizer collapses ALL user semantics to one name `"user_semantic"`
  (LegalizeWGSLEntryPointContext::getUserSemanticNameSlice, slang-ir-legalize-varying-params.cpp:5433-5437,
  name :5485). fixFieldSemanticsOfFlatStruct (:3986, loop :4060-4098) derives indices from semantic
  suffix digits: POSITION→0, NORMAL→0, TEXCOORD0→0, TEXCOORD1→1; the single `"user_semantic"` namespace
  makes three fields collide at 0 and `_returnNonOverlappingAttributeIndex` (:3891-3906) first-fit
  reassigns → (0,2,3,1).
- WGSL emitter prints `@location` from the (now-overwritten) semantic decoration index, never from the
  layout: emitSemanticsPrefixImpl, slang-emit-wgsl.cpp:325-337.
- Metal does NOT have this bug: keeps distinct semantic names (:4674-4678) and emits `[[attribute(N)]]`
  from layout offsets (slang-emit-metal.cpp:1676-1691).
- History: initial WGSL emitted @location from layout offsets (#5006, 170558c96); the `"user_semantic"`
  collapse + semantic-index emission introduced by #5498 (79056cd7e, Nov 2024), generalized by #6063
  (9b977e59c). → REGRESSION (code investigation confirmed behavior change between versions).

## Fix status: ALREADY IN FLIGHT — PR #13736 (verified)
PR #13736 "WGSL: vertex input locations follow the varying-input layout" (Daedie-git, open, non-draft,
CI green, in active maintainer review — jkwak-work Oct 22, tangent-vector Oct 23; last update 2026-10-24).
- WGSL emitter prints @location from the field key's layout; legalizer no longer reallocates varying
  offsets; flattening composes leaf layouts (exactly the "backends must use the front-end layout"
  principle of umbrella issue #13892, which names #9693).
- Empirically verified on its branch (94c49ee97, built locally): issue repro → 0,1,2,3 declared order;
  vk::location repro → 3,1,0,2 respected; semantic-less control unchanged; GLSL unchanged.
- PR's closing references do NOT include #9693 (closing: []) — link it on merge.

## Candidate approaches (only if #13736 stalls; not dispatching a fixer — would duplicate the PR)
- A (recommended, = what #13736 does): WGSL emitter reads @location from field key's VarLayout
  offsets like Metal/GLSL/SPIR-V; legalizer stops reallocating varying offsets. Restores
  cross-target consistency; blast radius = WGSL emit + shared legalizer paths (guarded by tests).
- B: Seed WGSL semantic decoration indices from VarLayout offsets inside
  fixFieldSemanticsOfFlatStruct. Same data source; repairs the data earlier; emitter contract
  unchanged.
- C (ruled out alone): stop collapsing semantic names to `"user_semantic"`. Insufficient — WGSL's
  flat @location namespace still collides across distinct names (POSITION:0 vs NORMAL:0).
- Test surface to watch: tests/wgsl/{varying-locations,nested-varying-input,buffer-array,
  interpolation-modifiers,shared-result-struct}.slang, tests/bugs/gh-9396.slang, gh-8388.slang,
  tests/metal/explicit-location.slang (also runs -target wgsl).

## Routing
PARKED — no fixer chain dispatched: a verified fix is already under review in #13736; a second PR
would collide. Next-action: maintainers review/merge #13736, then link/close #9693. One-shot re-check
scheduled via ncl (no recurrence).

## Sources
- Two independent local subagent traces (converged) over slang-ir-legalize-varying-params.cpp,
  slang-emit-wgsl.cpp, slang-parameter-binding.cpp, slang-type-layout.cpp + git history.
- DeepWiki Q&A (WGSL location assignment; vk::location doc-vs-implementation gap) — corroborates flow.
- Related issues: #13892 (umbrella, assigned jkwak-work), #12402, #10802, #12998, closed #8388, #5933.
  #8557 chain context (this group's memory/issues/8557.md) flagged this as a known gap.
