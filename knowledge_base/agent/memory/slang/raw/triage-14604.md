---
type: triage
title: "Triage: shader-slang/slang#14604 — stale current AST builder on -specialize path"
---

# Triage: shader-slang/slang#14604 — `-specialize` checks its type argument with a stale current AST builder
Date: 2026-11-18 | bug | high | P2 | frontend | Duplicate: no (same defect family as #13538, distinct unguarded path)

> **[Main annotation 11-18 19:5xZ]** The "#13538" family reference is correct but compresses context:
> it refers to OUR #13538 fix-PR chain (head 8f894f0) round-5 side-find — specialize-path code outside
> an AST-builder RAII scope, null builder on a worker thread (learning 1792060186315: "Found on #13538
> round 5"). The live #13538 issue is the E31215 unsized-arrays diagnostic. In-tree twin-guard precedent
> = PR #9245 (diff-verified). A fixer counter-claim that this was a "misattribution" was itself wrong
> and was corrected with receipts (chain record has the detail).

## What's broken / being requested
`EndToEndCompileRequest::executeActionsInner` parses + semantically checks `-specialize` type
arguments after the front-end's `SLANG_AST_BUILDER_RAII` has popped, so `getCurrentASTBuilder()`
(thread-local, slang-ast-builder.cpp:1823) returns whatever a prior compilation on the same thread
left there. In debug builds, `ASTBuilder::_findAppropriateASTBuilderForVal`
(slang-ast-builder.cpp:468) asserts when the stale builder is from a different linkage; release
builds silently allocate nodes in a foreign builder hierarchy (latent correctness hazard).
Order-dependent test failure in slang-test (shared in-process server runs all tests on one thread).

## Repro (CONFIRMED on master 4a1d62c5b, fresh Debug build, Linux x86_64)
```
./build/Debug/bin/slang-test \
    tests/serialization/std-lib-serialize.slang \
    tests/spirv/generic-entrypoint-specialization-capabilities.slang
```
→ 66% (8/12), subtests .1/.3/.5/.7 fail with
`assert failure: slang-ast-builder.cpp(468): nodeBuilder->isDescendentOf(this) || this->isDescendentOf(nodeBuilder)`.
Control: specialization test alone → 8/8 PASS. Matches the issue report exactly.

## Root-cause verification (all links code-confirmed)
- Thread-local: `gCurrentASTBuilder` slang-ast-builder.cpp:1823; setters only:
  `Session::init` (slang-global-session.cpp:70), `Session::~Session` (:149, conditional null),
  `SetASTBuilderContextRAII` (slang-ast-builder.h:1028, ~90 uses).
- Unguarded windows: `parseSpecializationArgStrings` check-shader.cpp:4161 (CheckTerm at :4198,
  SemanticsVisitor at :4186, `linkage->parseTermString` :4197); `_extractSpecializationArgs`
  (:3823, ExtractGenericArgVal :3843); internal `ComponentType::specialize` (linkable.cpp:427 —
  the RAII at :472 covers only the public SLANG_MCALL overload).
- Entry: end-to-end-request.cpp:229-239 block (m_passThrough == None) calls
  createSpecializedGlobalComponentType (:231) / createSpecializedGlobalAndEntryPointsComponentType
  (:235-236); no RAII anywhere in that file. Front-end RAII (compile-request.cpp:809-812) pops on return.
- Harness: tools/test-server/test-server-main.cpp single-threaded loop (:778); `-load-core-module`
  tool run creates a new GlobalSession via slang_createGlobalSessionWithoutCoreModule (:238) on the
  same thread — the stale TLS source.
- DeepWiki cross-check agrees: no scope established on this path.
- #13538-era guards (EntryPoint::_validateSpecializationArgsImpl check-shader.cpp:3854, PR #9245;
  public specialize linkable.cpp:472, PR #9685) do NOT cover this path — different function set.

## Sibling defects sharing the same hole (issue's open question — answer: YES, several)
1. `Module::_validateSpecializationArgsImpl` — check-shader.cpp:3625 (SemanticsVisitor :3642,
   isSubtype/witness checks) — no RAII, unlike the EntryPoint twin at :3854. HIGH, same chain
   (module/global generic args via internal specialize).
2. `spReflection_specializeType` chain — reflection-api.cpp:5575 → `Linkage::specializeType`
   check-shader.cpp:4210 (isSubtype :4248) — no RAII (the public session-API overload IS guarded,
   slang-session.cpp:610). MEDIUM — public C reflection API, not exercised by slangc.
3. `ComponentType::isSubType` — linkable.cpp:1230 — SemanticsVisitor::isSubtype, no RAII. MEDIUM-LOW.
4. `CompositeComponentType::_validateSpecializationArgsImpl` — linkable-impls.cpp:180 — covered
   transitively once Module (item 1) is fixed. `ComponentType::tryResolveOverloadedExpr`
   (linkable.cpp:946) — latent only (current callers inside own RAII). LOW.

## Candidate approaches
### Approach A: single RAII in EndToEndCompileRequest::executeActionsInner (reporter's proposal)
- Where: slang-end-to-end-request.cpp, wrap the block at :229-239 with
  `SLANG_AST_BUILDER_RAII(getLinkage()->getASTBuilder());`
- Behaviour delta: the `-specialize` parse/check/extract windows for this compile request run with
  the linkage's own builder current. Repro passes (reporter verified 12/12).
- Tradeoffs: smallest change; matches the established entry-point-guard pattern
  (FrontEndCompileRequest::executeActionsInner does exactly this for the front end).
- Risk: does not protect direct API users calling ComponentType::specialize / reflection APIs
  outside a compile request (items 2-4 remain latent, as today).
### Approach B: RAII inside each unguarded function (innermost guard)
- Where: parseSpecializationArgStrings :4161, _extractSpecializationArgs :3823,
  Module::_validateSpecializationArgsImpl :3625 (mirrors EntryPoint twin :3854),
  internal ComponentType::specialize linkable.cpp:427.
- Behaviour delta: every caller of these functions is protected, including API users.
- Tradeoffs: multiple edit points; some redundancy with existing outer guards (harmless — RAII
  nests fine); larger blast radius to review/test.
- Risk: low; the EntryPoint precedent (:3854) shows the pattern is accepted in-tree.
### Approach C: A + B + reflection chain (items 2-3)
- Where: A/B plus spReflection_specializeType chain and ComponentType::isSubType.
- Tradeoffs: most robust; touches public-API surfaces not exercised by the failing tests —
  no test currently demonstrates a failure there (latent only).
- Risk: speculative coverage without a failing test; scope creep for one PR.

## Recommended path
A (the reporter's verified fix, minimal and pattern-consistent) + the one-line
`SLANG_AST_BUILDER_RAII` in `Module::_validateSpecializationArgsImpl` (check-shader.cpp:3625,
mirroring the EntryPoint twin at :3854) since it sits on the exact same `-specialize` chain this
issue exercises (module/global generic args) — that closes every HIGH item. Items 2-3 (reflection
API, isSubType): file as a follow-up comment on the issue for maintainers, or a separate PR —
no failing test today; don't block this fix on them.

## Acceptance criteria
- Fresh Debug build: the two-test repro command passes (no `slang-ast-builder.cpp(468)` assert,
  generic-entrypoint-specialization-capabilities subtests .1/.3/.5/.7 pass in sequence after
  std-lib-serialize).
- Specialization test alone still 8/8; std-lib-serialize alone passes.
- No regressions: quick debug slang-test spot-run of serialization + spirv/generic tests, plus
  the fixer's normal targeted suites.

## Sources
- Local code verification (two read-only subagent passes over master 4a1d62c5b), this session.
- DeepWiki: "no AST-builder scope on the end-to-end specialization path" (search 15ca1297).
- Shared wiki: concepts/slang-compiler-api-ownership-and-frontend-guards.md (#13538 family),
  learnings 1792060186315, 1792061760327, 1794339896347.
- Related: #13538 (null-builder twin of this defect), PRs #9245, #9685 (prior guards).
