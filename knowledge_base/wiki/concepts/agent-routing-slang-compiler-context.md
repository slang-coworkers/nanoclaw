---
title: "Agent Routing: Slang Compiler Context"
type: concept
group: agent-routing
tags: [slang, diagnostics, parser, GPU, CI, reviewer, render-test, toolchain, IR, store-family]
source_count: 13
---

# Agent Routing: Slang Compiler Context

Slang compiler-specific facts that inform how the agent routing chain (triage, fixer, reviewer) operates, verifies claims, and gates actions when working on shader-slang/slang issues and PRs.

## TL;DR

- **Verify a peer's repo-state claim in the tree before filing it publicly** (counts, "X is all-zeros catalog-wide") — a public GitHub post is hard to reverse; a maintainer disproves a wrong premise immediately. `gh api ... issues -X POST` creates issues via the host proxy even when `gh auth status` reports the token invalid, but `gh api search/issues` 401s — use `gh issue list --search` for dup checks.
- **When Reviewer C (clarity) says "match the canonical sibling site," don't auto-trust the direction** — Reviewer A (correctness) may find the canonical site is itself inconsistent with the type declaration, so matching precedent propagates a latent bug. On A-vs-C conflict, A's repo-grounded reasoning usually wins; surface it as a disagreement-with-evidence and cross-check C's findings for internal consistency before forwarding.
- **Routing a decl through the shared declarator path silently broadens the accepted grammar** (arrays *and* pointers/parens) — enumerate the whole reachable surface and note that leading vs trailing multi-dim array forms are TRANSPOSES (`int[2][3]` → `Array<Array<int,2>,3>` vs `int T[2][3]` → `Array<Array<int,3>,2>`).
- **A real GPU (NVIDIA L40S) is provisioned — try the GPU first, don't assume "no GPU here."** But the toolchain may be missing (main container lacks `nvcc`/`nvrtc`/Vulkan loader — only the driver); verify `which nvcc`/`which vulkaninfo` and `install_packages` rather than declaring a repro impossible. Version-specific bugs (e.g. CUDA-12.4) need the matching toolkit, not just a newer driver.
- **The rich diagnostic renderer is TTY/color-gated** — piping `slangc | cat`/`| head` disables it and hides render bugs. Force it with `-diagnostic-color always`; use `-enable-machine-readable-diagnostics` for FileCheck-able span numbers.
- **"Warn (not error) that a target ignores a marker" is NOT a `[require]` capability gate** — `[require]` produces a hard error. Warn-once at the honoring-logic chokepoint (`getTypeLayoutRuleNameForBuffer`), add the diagnostic to `slang-diagnostics.lua`, plumb a `DiagnosticSink`.
- **A diagnostic inserted in `addExplicitParameterBindings_GLSL` is NOT Vulkan-only** — the early gate admits Khronos OR WGPU OR Metal; decide which gate to sit behind. And "reported twice ⇒ matches sibling precedent" is a false justification — check the cited sibling test's actual annotation count and the real diagnostic name.
- **Confirm a `#if` test-gate macro is an actual compile-define for the target** (`SLANG_ENABLE_DXIL_SUPPORT` is a PRIVATE `0`/`1` define via `set_default_compile_options`); `SLANG_IGNORE_TEST` is the runtime skip alternative.
- **Verify the LOWERED op, not surface syntax:** `InterlockedExchange` lowers to `AtomicExchange`, not `AtomicStore`; the store-of-undef peephole elides only plain `kIROp_Store` of `IRUndefined`, never Atomic/Swizzle/MatrixSwizzle stores.
- **`render-test -render-features <name>` is a two-stage gate:** an unknown name is a loud `SLANG_FAIL` (from the pinned slang-rhi header's allow-list), an unsupported device is a silent IGNORE — so the test file and the submodule pin bump are hard-coupled and must travel together.
- **A PR's own doc comment can be factually wrong** (#11779: module precompilation IS gated by `isFinalCodegenLink`) — trace the actual call path, don't trust the comment.

## Verifying Peer Repo-State Claims Before Public Filing

When a downstream reviewer/peer hands up a repo-state claim ("X is all-zeros catalog-wide", "generator never computes it"), verify the exact counts in the tree before posting a public GitHub issue asserting it. On shader-slang/slang#11410 the `doc_section_digest` field was reported as "all-zeros catalog-wide" — in fact 224/323 (~69%) are 0x00 placeholders but 99/323 (~31%) carry real SHA-256 digests. Filing the verbatim claim would have been disproved by a maintainer immediately. Public GitHub posts are hard-to-reverse external actions — when the premise changes after a parent's approval, confirm with the corrected framing first ([slang diagnostics-catalog doc_section_digest gap + verify peer repo-state claims before public filing](wiki/learnings/1780353662163-slang-diagnostics-catalog-doc-section-digest-gap-v.md)).

Also: `gh api repos/<o>/<r>/issues -X POST --input <json>` creates issues via the host proxy even when `gh auth status` reports the GH_TOKEN invalid; `gh api search/issues` returns 401 — use `gh issue list --search` for dup checks ([slang diagnostics-catalog doc_section_digest gap + verify peer repo-state claims before public filing](wiki/learnings/1780353662163-slang-diagnostics-catalog-doc-section-digest-gap-v.md)).

## Reviewer Disagreement: Canonical Precedent vs Correctness

When Reviewer C (clarity) flags a type/encoding drift between a new site and a "canonical" sibling site, do NOT auto-trust the direction "make new site match the canonical site." Reviewer A (correctness) operates at higher rigor and may discover the canonical site is itself inconsistent with the underlying type declaration, in which case "matching the precedent" propagates a latent bug.

Concrete instance (shader-slang/slang#11499 v2): C said switch new fallback's `format` literal from `getIntType()` to `getUIntType()` to match the sibling site. Then Reviewer A reversed: `hlsl.meta.slang:832` declares `let format:int`, and `IRBuilder::getIntValue` keys constants on their type operand — a `uint 0` and an `int 0` are distinct constants. When merging A and C reviews, surface this as a disagreement-with-evidence rather than picking a side: A's reasoning grounded in repo facts usually trumps C's precedent-matching when they conflict ([Reviewer-disagreement: 'match canonical precedent' vs 'precedent is itself wrong](wiki/learnings/1780733925284-reviewer-disagreement-match-canonical-precedent-vs.md)).

## Routing a Decl Through Shared Declarator Machinery

When a Slang parser fix routes a declaration through the shared declarator path (`parseDeclarator` + `UnwrapDeclarator`, as in the `parseTypeDef` fix for shader-slang/slang#11569 / issue #11567), the change accepts the entire non-abstract declarator grammar, not just the targeted surface form. Two non-obvious consequences:

1. **Pointer / parenthesized declarators become accepted too.** If the PR's description only mentions arrays, flag that the actual accepted grammar is broader.
2. **Multi-dimensional leading vs trailing array forms are TRANSPOSES, not equal.** `typedef int[2][3] T` (leading) produces `Array<Array<int,2>,3>`; `typedef int T[2][3]` (trailing) produces `Array<Array<int,3>,2>`. They coincide only for a single dimension.

When reviewing any parser change that swaps a hand-rolled read for the shared declarator path, enumerate the full grammar now reachable (array, pointer, paren), check the multi-dim transpose nuance, and recommend pinning the newly-enabled forms with tests ([Routing a decl through shared declarator machinery silently broadens accepted grammar — review the whole declarator surface, not the target form](wiki/learnings/1781223729779-routing-a-decl-through-shared-declarator-machinery.md)).

## GPU Availability — L40S Is Present

A real GPU is provisioned: `nvidia-smi` (2026-06-16) shows NVIDIA L40S, 46 GB, driver 565.57.01, CUDA 12.7, idle. Coworkers should NOT assume "no GPU here" and skip GPU repros by default — try the GPU first. Caveat: in the orchestrator (main) container, `nvcc`/`nvrtc` (CUDA toolkit) and the Vulkan loader are NOT installed — only the driver. Before a GPU repro, verify your container's toolchain (`which nvcc`, `which vulkaninfo`) and request missing tools via `install_packages` rather than declaring the repro impossible. slang#10689 (NVRTC 12.4 CUDA codegen bug) needs the CUDA 12.4 toolkit specifically — we have a 12.7 driver but the bug is 12.4-version-specific ([GPU is available (NVIDIA L40S) — don't assume 'no GPU'; toolchain may need install](wiki/learnings/1781607246297-gpu-is-available-nvidia-l40s-don-t-assume-no-gpu-t.md)).

## PR Review: Cross-Check Reviewer C Findings

When merging three `/slang-pr-review` reviewers, do NOT forward Reviewer C (clarity) suggestions as safe-to-apply without cross-checking — C can produce findings that are internally inconsistent or that contradict Reviewer A's deeper correctness trace. Concrete case (shader-slang/slang#11628, WGSL `emitVarKeywordImpl`): C's FG001 told the author to remove exclusions, claiming a predicate was only read in one place; C's own FG002 contradicted this by discussing the predicate at a second site, and Reviewer A's correctness editorial correctly dropped that advice as unsafe. Before sending `combined-review.md`, skim C's findings for internal consistency; where C suggests a refactor that A or A's drop-list touches, trust A ([slang-pr-review: cross-check Reviewer C clarity findings against A and for internal consistency before forwarding](wiki/learnings/1781627346796-slang-pr-review-cross-check-reviewer-c-clarity-fin.md)).

## Slang Rich Diagnostic Renderer Is TTY/Color-Gated

The fancy box-drawing renderer (`╭╼ │ ━ ──╯`) in `source/compiler-core/slang-rich-diagnostics-render.cpp` is auto-enabled only when stderr is a color-capable TTY (commit 2eeac7f19). Piping `slangc` through `| cat`/`| head` disables color → falls back to the plain `-->/|/^` path, which often does NOT exhibit the rendering bug. Fix: force the renderer with `-diagnostic-color always` (optionally `-enable-experimental-rich-diagnostics`). Also use `-enable-machine-readable-diagnostics` for a deterministic, FileCheck-able view of the underlying span numbers. Observed on #11684: `unexpectedEndOfFile` duplicates the last char — the renderer's zero-width EOF span causes `makeLayoutSpan` length=-1 → `renderSourceLine` re-emits the leading char ([Slang rich diagnostic renderer is tty/color-gated — pipe-masking trap when reproducing render bugs](wiki/learnings/1782151905566-slang-rich-diagnostic-renderer-is-tty-color-gated-.md)).

## Buffer Layout Marker Warning Needs a New Diagnostic

When asked to warn (not error) that a buffer data-layout marker isn't honored by a target (e.g. `RWStructuredBuffer<T, ScalarDataLayout>` silently ignored on Metal → stride mismatch / OOB, slangpy#1014), do NOT solve it by giving `ScalarDataLayout` the `[require(...)]` treatment. Slang's `[require]` capability system models availability only — it produces a hard ERROR, not a non-fatal warning. The clean chokepoint is `getTypeLayoutRuleNameForBuffer` in `source/slang/slang-ir-lower-buffer-element-type.cpp:2407` — where the marker is dropped for non-Khronos/non-CPU targets — and where both target + marker are known. Extract the honoring-logic predicate, warn-once there, add the diagnostic to `slang-diagnostics.lua`, and plumb a `DiagnosticSink` into `LoweredElementTypeContext` ([Slang buffer-layout-marker warning needs a new diagnostic, not a capability gate](wiki/learnings/1782158570480-slang-buffer-layout-marker-warning-needs-a-new-dia.md)).

## vk::location-on-non-varying Warning (#6216): Param-Binding Gate Placement

Reviewing shader-slang/slang#11705 (the #6216 fix) surfaced two non-obvious facts for future reviews touching `addExplicitParameterBindings_GLSL`:

1. **Target-scope gotcha — the new warning is NOT Vulkan/GLSL-only.** The function's early-return gate (~line 1143-1145) admits Khronos OR WGPU OR Metal. The warning was inserted between the two gates (~line 1175), so it fires on Metal and WGSL too. When adding a diagnostic in this function, decide explicitly which gate you want to sit behind.
2. **"Reported twice ⇒ matches sibling precedent" is a false justification.** The PR claimed the warning prints twice for an entry-point compile, matching sibling W39029. Verified false: the real sibling test annotates its `E39029` warning once. The doubling only happens when the global parameter is referenced by the entry-point. Also: the PR's cited diagnostic name `register-without-vulkan-binding` does not exist — real name is `register-modifier-but-no-vk-binding-nor-shift`, code 39029. When a PR justifies a hard-coded emission count by precedent, check the cited sibling test's actual annotation count ([vk::location-on-non-varying warning (#6216): the param-binding gate placement and the 'double-emission matches precedent' trap](wiki/learnings/1782225149459-vk-location-on-non-varying-warning-6216-the-param-.md)).

## Validating Slang Test-Gate #if Fixes

When the proposed fix for a unit-test build-config bug is a preprocessor guard like `#if SLANG_WINDOWS_FAMILY && SLANG_ENABLE_DXIL_SUPPORT` (issue #11733), confirm the macro is an actual compile-time define for the target. In the slang tree: `cmake/CompilerFlags.cmake:227` — `set_default_compile_options()` adds PRIVATE define `SLANG_ENABLE_DXIL_SUPPORT=$<BOOL:${SLANG_ENABLE_DXIL}>` as literal `0` or `1`; `slang-unit-test` is created via `slang_add_target(... USE_FEWER_WARNINGS ...)` → macro guaranteed defined. The framework also has a runtime alternative: `SLANG_IGNORE_TEST` → `TestResult::Ignored` for reporting a skipped (rather than absent) test ([Validate slang test-gate #if fixes: confirm the macro is a compile-define for that target](wiki/learnings/1782318227042-validate-slang-test-gate-if-fixes-confirm-the-macr.md)).

## Store-Family: Surface Syntax and Peephole Gate

When writing tests for `getInstructionUsageType` in `slang-ir-use-uninitialized-values.cpp`, verify the LOWERED op, not the surface syntax:
- `kIROp_AtomicStore` is reached ONLY by direct assignment to an `Atomic<T>` lvalue. `InterlockedExchange` does NOT lower to `AtomicStore` — it lowers to `AtomicExchange`.
- `kIROp_MatrixSwizzleStore` comes from matrix swizzle assignment: `m._m00_m11 = uninit;`.
- Store-family operand layout: operand 0 = destination (write), operand 1 = value/source (read) for all four ops.

The store-of-undef peephole (`slang-ir-peephole.cpp`) elides ONLY plain `kIROp_Store` of an `IRUndefined` value — NOT AtomicStore/SwizzledStore/MatrixSwizzleStore. For a `DIAGNOSTIC_TEST`, the caret points at the store operator (`=`) for scalar/buffer/param/swizzle/atomic cases, but at the `uninit` token (full-width `^^^^^^` span) for the matrix-swizzle case ([Slang store-family: which surface syntax hits AtomicStore/MatrixSwizzleStore + peephole-vs-checker gate](wiki/learnings/1782442658975-slang-store-family-which-surface-syntax-hits-atomi.md)).

## #11779 Precompilation IS Gated by `isFinalCodegenLink`

The PR's own `isFinalCodegenLink` doc comment (`slang-ir-link.cpp ~line 63`) is factually wrong about module precompilation. It says the flag is "false for `prelinkIR` and module precompilation." Only `prelinkIR` keeps it false. Module precompilation routes through `Module::precompileForTarget` → `emitPrecompiledDownstreamIR` → `_emitEntryPoints` → `linkAndOptimizeIR` → `linkIR`, and `linkIR` unconditionally sets `isFinalCodegenLink = true`. So precompilation IS gated. For the clarity reviewer (C001): the new `shouldDeepCloneWitnessTable` comment says "defer the entries" but every differentiable-interface requirement is `__builtin_requirement`-keyed so they all hit the eager-clone path — the actual win is that the table is no longer force-deep-cloned via `[HLSLExport]` ([slang #11779 — precompilation IS gated by isFinalCodegenLink (PR comment is wrong)](wiki/learnings/1782478960515-slang-11779-precompilation-is-gated-by-isfinalcode.md)).

## render-test `-render-features` Is a Two-Stage Gate

A `-render-features <name>` COMPARE_COMPUTE line passes through two distinct gates:
1. **Name-validity (compile-time, from the pinned slang-rhi header).** `tools/render-test/options.cpp:21` (`isValidFeatureName`) builds its allow-list from the `SLANG_RHI_FEATURES` X-macro. An unrecognized name returns `SLANG_FAIL` (loud test failure, NOT an ignore). A feature name is only "safe" on no-GPU CI if the pinned slang-rhi actually defines it.
2. **Device-support (runtime).** Valid name → `rhi::Feature::id` → createDevice; device lacks feature → `SLANG_E_NOT_AVAILABLE` → slang-test reports IGNORED.

The "IGNORED is safe on no-GPU CI" rule presumes the name already passed gate 1. For a slang test that depends on a new slang-rhi feature, the test file and the submodule pin bump are HARD-coupled — they must travel together. Verified on shader-slang/slang#11792 (abort/`shader-abort`, slang-rhi#782) ([render-test -render-features is a TWO-stage gate: unknown name = loud SLANG_FAIL, unsupported device = silent IGNORE](wiki/learnings/1782564838123-render-test-render-features-is-a-two-stage-gate-un.md)).

---
**Source learnings (13):**
- [slang diagnostics-catalog doc_section_digest gap; verify peer repo-state claims](wiki/learnings/1780353662163-slang-diagnostics-catalog-doc-section-digest-gap-v.md)
- [Reviewer disagreement: match canonical precedent vs precedent is wrong](wiki/learnings/1780733925284-reviewer-disagreement-match-canonical-precedent-vs.md)
- [Routing a decl through shared declarator machinery broadens accepted grammar](wiki/learnings/1781223729779-routing-a-decl-through-shared-declarator-machinery.md)
- [GPU is available (NVIDIA L40S) — don't assume no GPU](wiki/learnings/1781607246297-gpu-is-available-nvidia-l40s-don-t-assume-no-gpu-t.md)
- [slang-pr-review: cross-check Reviewer C clarity findings before forwarding](wiki/learnings/1781627346796-slang-pr-review-cross-check-reviewer-c-clarity-fin.md)
- [Slang rich diagnostic renderer is tty/color-gated](wiki/learnings/1782151905566-slang-rich-diagnostic-renderer-is-tty-color-gated-.md)
- [Slang buffer-layout-marker warning needs a new diagnostic, not a capability gate](wiki/learnings/1782158570480-slang-buffer-layout-marker-warning-needs-a-new-dia.md)
- [vk::location-on-non-varying warning #6216: param-binding gate placement](wiki/learnings/1782225149459-vk-location-on-non-varying-warning-6216-the-param-.md)
- [Validate slang test-gate #if fixes: confirm the macro is a compile-define](wiki/learnings/1782318227042-validate-slang-test-gate-if-fixes-confirm-the-macr.md)
- [Slang store-family: which surface syntax hits AtomicStore/MatrixSwizzleStore](wiki/learnings/1782442658975-slang-store-family-which-surface-syntax-hits-atomi.md)
- [slang #11779: precompilation IS gated by isFinalCodegenLink](wiki/learnings/1782478960515-slang-11779-precompilation-is-gated-by-isfinalcode.md)
- [render-test -render-features is a two-stage gate](wiki/learnings/1782564838123-render-test-render-features-is-a-two-stage-gate-un.md)
- [Supervisor artifact-enforcement nudge yields to operator comment-gate](wiki/learnings/1780986083496-supervisor-artifact-enforcement-nudge-yields-to-th.md)
_Catalog: [[wiki/index.md]]_
