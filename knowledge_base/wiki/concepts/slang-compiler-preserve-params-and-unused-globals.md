---
title: "slangc -preserve-params: source-verified mechanism, downstream spirv-opt DCE, and the byte-address-buffer emission fix (PR #14045)"
type: concept
group: slang-compiler
tags: [slang, preserve-params, PreserveParameters, O0, optimization-level, spirv-opt, aggressive-dce, deadCodeElimOptions, keepGlobalParamsAlive, IRGlobalParam, byte-address-buffer, #6947, PR #14045]
source_count: 2
---

# slangc `-preserve-params`: what actually strips unused globals

`-preserve-params` (`PreserveParameters`) keeps unreferenced shader parameters alive. The mechanism is now source-verified, and the commonly reported "only works at `-O0`" behavior is a downstream-optimizer artifact, not a Slang IR gap. What each SPIR-V optimization level runs is on [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]]; the byte-address legalization context is on [[wiki/concepts/slang-compiler-ir-clones-linkage-and-pass-roots.md]].

## TL;DR

- **`-preserve-params` IS honored by Slang's own IR passes**: `IRSimplificationOptions::getDefault`/`getFast` copy it into `deadCodeElimOptions.keepGlobalParamsAlive`, and the SPIR-V emitter emits unreferenced `IRGlobalParam`s when enabled.
- **What strips unused globals at `-O1`+ is the downstream spirv-opt run** (invoked only when optimization level != None; its pass set includes `CreateAggressiveDCEPass`), which is skipped at `-O0` — so "preserve-params only works at -O0" is a downstream-optimizer artifact, not a Slang IR gap.
- **Unused byte-address buffers + `-preserve-params` aborted SPIR-V emission before PR #14045** (merged 2026-11-02): byte-address legalization only translated parameters an operation reached; the fix translates unused ones like used ones. A `-preserve-params` crash report on an old slangc: check for unused byte-address buffers and point to a post-Nov-2026 build.
- **#6947** (unused bindings stripped despite `PreserveParameters`) is still open and remains the canonical tracking issue to cite.
- **An unused `ParameterBlock` is stripped from the layout — it never consumes a descriptor set.** A test needing N blocks to occupy N sets must sample/read from each block in the entry point; declaring it is not enough.

## The verified mechanism

`IRSimplificationOptions::getDefault`/`getFast` copy the flag into `deadCodeElimOptions.keepGlobalParamsAlive`, and the SPIR-V emitter emits unreferenced `IRGlobalParam`s when it is enabled — this part was previously inferred and is now source-verified. The stripping at `-O1`+ happens in the downstream spirv-opt run, whose pass set includes `CreateAggressiveDCEPass` and which only runs when the optimization level != None. Discord answers about "preserve-params doesn't work / crashed" can therefore lead with two concrete causes: spirv-opt aggressive DCE at `-O1`+, and the fixed byte-address emission bug ([verified mechanism + byte-address fix](../learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md)).

## Unused ParameterBlocks never consume a set — tests must make them live

Stripping is not limited to optimizer-driven DCE of globals: an unused `ParameterBlock` is stripped from the layout itself, so it never consumes a descriptor set. A test shader that needs N parameter blocks to occupy N sets must actually sample/read from each block in the entry point (discovered writing the #14730 two-block bindless-space reservation test variant: the second block silently vanished until it was used in `main()`). The general rule: any test that pins a space/set allocation must make the occupying resource live, not just declare it ([unused ParameterBlock is stripped from layout](../learnings/1795688581455-unused-parameterblock-is-stripped-from-layout-test.md)).

**Source learnings (2):**
- [-preserve-params honored via deadCodeElimOptions.keepGlobalParamsAlive; spirv-opt aggressive DCE strips at -O1+; PR #14045 fixed unused byte-address buffers aborting SPIR-V emission; #6947 still open](../learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md)
- [unused ParameterBlock is stripped from layout — tests must sample from it to consume a set](../learnings/1795688581455-unused-parameterblock-is-stripped-from-layout-test.md) — any test pinning a space/set allocation must make the occupying resource live

_Catalog: [[wiki/index.md]]_
