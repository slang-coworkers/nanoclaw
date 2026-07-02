---
title: "Slang Compiler Technical Findings"
type: concept
group: general-misc
tags: [slang, compiler, spirv, ir, descriptor-heap, coopmat, deepwiki, rebase, expected-failure, uninit-checker, macro, diagnostics]
source_count: 12
---

# Slang Compiler Technical Findings

Concrete technical findings about the Slang compiler codebase: verifying external-tool behavior at pinned SHA, IR crash diagnosis methodology, descriptor-heap specialization, cooperative matrix coverage, rebase experiment pitfalls, expected-failure list semantics, and platform macro conversion hazards.

## DeepWiki Can Miss Bulk-Declaration Files — Verify at Pinned SHA

DeepWiki's RAG indexing can miss files that define semantic content via string literals (e.g. `Initialize.cpp` / `Builtins.cpp` in glslang) because these chunk away from the declaration sites a question asks about. Before flagging a "contradiction" between a code claim and DeepWiki's answer about an external/vendored repo, read the actual source at the exact submodule SHA — `curl https://raw.githubusercontent.com/.../<pinned-sha>/<file>` then grep. A DeepWiki "no, X doesn't do Y" answer is a hypothesis, not a fact. Submodule-pinned versions can differ from the `main`/HEAD that DeepWiki indexes. ([deepwiki-can-miss-files-in-large-or-vendored-codebases-cross-check-source](wiki/learnings/1779621016571-deepwiki-can-miss-files-in-large-or-vendored-codeb.md))

Similarly, DeepWiki conflates cooperative-**vector** and cooperative-**matrix** accumulate operations. When asked about SM 6.10 `linalg` `InterlockedAccumulate`, DeepWiki answers "yes" and cites CoopVec helpers — but the `Matrix::Accumulate` and `Matrix::InterlockedAccumulate` methods are genuinely absent from `struct CoopMat` in `hlsl.meta.slang` (verified at HEAD). Always confirm CoopMat method coverage by reading `hlsl.meta.slang` directly. The string `InterlockedAccumulate` appears in the CoopVec prelude — a name collision, not matrix support. ([CoopMat vs CoopVec linalg InterlockedAccumulate — DeepWiki conflates them](wiki/learnings/1781544794615-coopmat-vs-coopvec-linalg-interlockedaccumulate-de.md))

## IR Crash Diagnosis: Use --dump-ir, Not Stack Trace Alone

When a Slang IR-pass crash provides a stack trace, the call frame nearest the assertion is a starting hypothesis, not an empirical answer. For any IR-pass crash, the triage memo should either include a `--dump-ir` step against the repro before committing to a single candidate fix site, or explicitly tell the fixer "verify with `--dump-ir` before picking among the candidates" and rank candidates as hypotheses. For subsystems like witness-table lookup in dynamic-dispatch specialization there can be five or more unguarded `findWitnessTableEntry` callers, so any "missing null-check" hypothesis is plausibly multi-site. ([Don't trust the stack-trace-implied fix site alone — dump-IR the repro](wiki/learnings/1780683697167-don-t-trust-the-stack-trace-implied-fix-site-alone.md))

## Descriptor-Heap [noinline] Fix: Reuse Hoistable Heap Global

For `kIROp_SPIRVLoadDescriptorFromHeap` through function-call specialization (the fix for shader-slang/slang#11498): route it through the existing specialization allowlist sites (`isParamSuitableForSpecialization`, `getCallInfoForArg`, `getSpecializedValueForArg`) the same way `IRCastDescriptorHandleToResource` is handled. In `getSpecializedValueForArg`, reuse the hoistable heap global directly in the cloned callee and parameterize only the `index`, keying the new value on the result type — not on re-loading the heap as a scalar param. Parameterizing the heap builtin global as a `uint` `OpFunctionParameter` makes the cloned callee use a uint scalar as the base of `OpUntypedAccessChainKHR`, which is invalid SPIR-V. A text-only FileCheck plus green local tests will not catch this — always run `SLANG_RUN_SPIRV_VALIDATION=1` to verify structural SPIR-V validity. ([Approach-A fix for descriptor-heap [noinline] texture params: reuse the hoistable heap global, do NOT parameterize it as uint](wiki/learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md))

## ResourceDescriptorHeap/SamplerDescriptorHeap Is Front-End Surface Work

The entire descriptor-heap backend already exists and is reachable via `DescriptorHandle<T>`. `ResourceDescriptorHeap` and `SamplerDescriptorHeap` are not input-language builtins — they appear only as HLSL emission output (`slang-emit-hlsl.cpp:1328-1345`). A request to support this input syntax is front-end surface-syntax work, not new codegen. The recommended implementation is to declare magic globals in `hlsl.meta.slang` whose `operator[]` yields `DescriptorHandle<T>`, riding the existing handle→T implicit-conversion and lowering. ([ResourceDescriptorHeap/SamplerDescriptorHeap input syntax is front-end-only — backend already exists](wiki/learnings/1781219589907-resourcedescriptorheap-samplerdescriptorheap-input.md))

## E31106/E31107 Fire on Compiler-Synthesized Entry-Point Uniform Groups

E31106/E31107 (locationless warnings about mixed-resource CB groups) can fire on a plain single-file compute entry-point that mixes resource params with a `uniform` ordinary param — not only on imported-module structs. The offending `ConstantBuffer<>` is compiler-synthesized by `CollectEntryPointUniformParams::ensureCollectedParamAndTypeHaveBeenCreated()`. The warning was designed for user-authored mixed `cbuffer`/`[vk::push_constants]` groups; firing it on the synthesized entry-point group is over-eager. The recommended fix is to restrict E31106/E31107 to source-authored groups by marking the synthesized struct and skipping the diagnose. Key constraints: `getConstantBufferType` is a deduplicated type-getter and cannot carry a per-instance `sourceLoc`; the location marker must live on the non-deduped `paramStructType`. ([E31106/E31107 also fire on the SYNTHESIZED entry-point uniform param group (not just imported modules)](wiki/learnings/1782751325517-e31106-e31107-also-fire-on-the-synthesized-entry-p.md))

## Controlled-Rebase Experiments Mislead When the Change Is Cross-Cutting

When a rebase-onto-master experiment shows "unrelated" tests failing, do not conclude "master-level regression" without first checking the exact-tree merge_group result. A change that looks isolated (e.g. qualifying extension-method name hints) can be cross-cutting: `getNameForNameHint` feeds SPIR-V debug names AND every C-like emitter's generated identifiers AND diagnostic call-site notes, so it silently breaks any test that hard-codes an extension-method symbol name. The decisive cheap check: find the merge_group run whose branch is `gh-readonly-queue/master/pr-<lastPR>-<sha>` where `<sha>` == current master HEAD's parent; that run tested the exact current-HEAD tree. If it's 100% green, master is not red and the regression lives in the experiment's own delta. Do not post "master is red" to GitHub before the exact-tree merge_group check. ([Controlled-rebase experiments mislead when the 'isolated' change is cross-cutting (name hints/mangling)](wiki/learnings/1781841056611-controlled-rebase-experiments-mislead-when-the-iso.md))

## Expected-Failure List Only Reclassifies a Fail — Passing Tests Stay Pass

An entry in Slang's `-expected-failure-list` files (`tests/expected-failure-coverage.txt`, `expected-failure-no-gpu.txt`) reclassifies a result only when `result == Fail` — a listed test that passes is left as Pass, not reclassified. A non-platform-scoped entry on a platform where the test passes yields XPASS noise but never a red build (no failure counter increment, no exit code change). Before recommending platform-gating/relocating an expected-failure entry as a correctness fix, check whether the test actually fails on the platform in question. If it passes there, the entry is at worst cosmetic noise. ([expected-failure list only reclassifies a Fail — never reddens a passing listed test](wiki/learnings/1781641446803-expected-failure-list-only-reclassifies-a-fail-nev.md))

## LANG_SERVER Harness Cannot Observe Diagnostics in Test Mode

The `//TEST:LANG_SERVER` harness cannot observe published diagnostics in test mode — the `publishDiagnostics` throttle/debounce is dead/disabled in test mode, so a FileCheck on diagnostics sees nothing. You cannot currently write a committable automated regression test for an LSP-diagnostic bug (false/missing diagnostics on didOpen) via that harness. What works instead: verify against real `slangd` with an A/B probe (control vs. fix branch), comparing the actual published diagnostic set. ([CORRECTION: //TEST:LANG_SERVER harness can't observe diagnostics in test mode (re #11532)](wiki/learnings/1781116005493-correction-test-lang-server-harness-can-t-observe-.md))

## Uninit Checker: Storing an Address Is Not a Read

In the Slang uninitialized-use checker (`getInstructionUsageType`), when adding an operand-role split so the VALUE operand (operand 1) of store instructions counts as a read, exclude pointer-typed value operands: `inst == user->getOperand(1) && !as<IRPtrTypeBase>(inst->getDataType())`. Storing an address (a `Ptr(...)` value) does not read the pointed-to memory, so flagging it produces a spurious E41016. Key on `inst->getDataType()` (the tracked operand), not the user (Store is void-typed). For any shared frontend pass with broad blast radius, run the full `tests/` sweep (not just the directory containing the new test) before pushing — a green sweep of one directory is not sufficient proof. ([Uninit-checker: storing an ADDRESS isn't a read; and run the FULL suite for broad-blast-radius frontend changes](wiki/learnings/1782448931140-uninit-checker-storing-an-address-isn-t-a-read-and.md))

## Macro Conversion: Presence→Value Can Silently Narrow Platform Coverage

When converting Slang's value-style platform macros from `#ifdef X` / `defined(X)` to `#if X`, watch for asymmetric `_FAMILY`-aggregate arms. The broken always-true presence test may have been masking the fact that the chosen macro does not cover the intended platform family. For each arm of the conversion, enumerate exactly which platforms the new macro selects versus what the old always-true test admitted. If one side uses a `_FAMILY` aggregate, check whether the sibling side should also use one (e.g. `SLANG_APPLE_FAMILY` instead of bare `SLANG_OSX` to include iOS). ([Converting presence→value macro tests can silently narrow platform coverage (iOS dropped from dlfcn)](wiki/learnings/1782324227290-converting-presence-value-macro-tests-can-silently.md))

## Document a Guard's Guarantee, Not Arrival Paths

When documenting a guard/predicate that is provenance-agnostic (rejects X regardless of how X arrived), document what it **guarantees** — not a specific enumeration of how the bad input arrives. Enumerating arrival paths is fragile: the claim is a checkable assertion about compiler behavior that can be wrong even when the guard is correct. In one three-round review, three separate mechanistic explanations for why a foreign-FileDecl case was supposedly impossible were each wrong, while the guard conjunct itself was always correct. Prefer "this drops X regardless of provenance" over "X can only arrive via Y." ([Document a guard's guarantee, not the enumeration of how the bad input arrives](wiki/learnings/1780493380222-document-a-guard-s-guarantee-not-the-enumeration-o.md))

---
**Source learnings (12):**
- [DeepWiki can miss files in large or vendored codebases](wiki/learnings/1779621016571-deepwiki-can-miss-files-in-large-or-vendored-codeb.md)
- [CoopMat vs CoopVec linalg InterlockedAccumulate — DeepWiki conflates them](wiki/learnings/1781544794615-coopmat-vs-coopvec-linalg-interlockedaccumulate-de.md)
- [Don't trust the stack-trace-implied fix site alone — dump-IR the repro](wiki/learnings/1780683697167-don-t-trust-the-stack-trace-implied-fix-site-alone.md)
- [Approach-A fix for descriptor-heap [noinline] texture params](wiki/learnings/1780769595819-approach-a-fix-for-descriptor-heap-noinline-textur.md)
- [ResourceDescriptorHeap/SamplerDescriptorHeap input syntax is front-end-only](wiki/learnings/1781219589907-resourcedescriptorheap-samplerdescriptorheap-input.md)
- [E31106/E31107 also fire on the SYNTHESIZED entry-point uniform param group](wiki/learnings/1782751325517-e31106-e31107-also-fire-on-the-synthesized-entry-p.md)
- [Controlled-rebase experiments mislead when the isolated change is cross-cutting](wiki/learnings/1781841056611-controlled-rebase-experiments-mislead-when-the-iso.md)
- [Expected-failure list only reclassifies a Fail — never reddens a passing listed test](wiki/learnings/1781641446803-expected-failure-list-only-reclassifies-a-fail-nev.md)
- [CORRECTION: LANG_SERVER harness can't observe diagnostics in test mode](wiki/learnings/1781116005493-correction-test-lang-server-harness-can-t-observe-.md)
- [Uninit-checker: storing an address isn't a read](wiki/learnings/1782448931140-uninit-checker-storing-an-address-isn-t-a-read-and.md)
- [Converting presence→value macro tests can silently narrow platform coverage](wiki/learnings/1782324227290-converting-presence-value-macro-tests-can-silently.md)
- [Document a guard's guarantee, not the enumeration of how the bad input arrives](wiki/learnings/1780493380222-document-a-guard-s-guarantee-not-the-enumeration-o.md)
_Catalog: [[wiki/index.md]]_
