---
title: "slangc -preserve-params: source-verified mechanism, downstream spirv-opt DCE, and the byte-address-buffer emission fix (PR #14045)"
type: concept
group: slang-compiler
tags: [slang, preserve-params, PreserveParameters, O0, optimization-level, spirv-opt, aggressive-dce, deadCodeElimOptions, keepGlobalParamsAlive, IRGlobalParam, byte-address-buffer, #6947, PR #14045]
source_count: 1
---

# slangc `-preserve-params`: what actually strips unused globals

`-preserve-params` (`PreserveParameters`) keeps unreferenced shader parameters alive. The mechanism is now source-verified, and the commonly reported "only works at `-O0`" behavior is a downstream-optimizer artifact, not a Slang IR gap. What each SPIR-V optimization level runs is on [[wiki/concepts/slang-backends-spirv-spirv-opt-and-optimization-levels.md]]; the byte-address legalization context is on [[wiki/concepts/slang-compiler-ir-clones-linkage-and-pass-roots.md]].

## TL;DR

- **`-preserve-params` IS honored by Slang's own IR passes**: `IRSimplificationOptions::getDefault`/`getFast` copy it into `deadCodeElimOptions.keepGlobalParamsAlive`, and the SPIR-V emitter emits unreferenced `IRGlobalParam`s when enabled.
- **What strips unused globals at `-O1`+ is the downstream spirv-opt run** (invoked only when optimization level != None; its pass set includes `CreateAggressiveDCEPass`), which is skipped at `-O0` — so "preserve-params only works at -O0" is a downstream-optimizer artifact, not a Slang IR gap.
- **Unused byte-address buffers + `-preserve-params` aborted SPIR-V emission before PR #14045** (merged 2026-11-02): byte-address legalization only translated parameters an operation reached; the fix translates unused ones like used ones. A `-preserve-params` crash report on an old slangc: check for unused byte-address buffers and point to a post-Nov-2026 build.
- **#6947** (unused bindings stripped despite `PreserveParameters`) is still open and remains the canonical tracking issue to cite.

## The verified mechanism

`IRSimplificationOptions::getDefault`/`getFast` copy the flag into `deadCodeElimOptions.keepGlobalParamsAlive`, and the SPIR-V emitter emits unreferenced `IRGlobalParam`s when it is enabled — this part was previously inferred and is now source-verified. The stripping at `-O1`+ happens in the downstream spirv-opt run, whose pass set includes `CreateAggressiveDCEPass` and which only runs when the optimization level != None. Discord answers about "preserve-params doesn't work / crashed" can therefore lead with two concrete causes: spirv-opt aggressive DCE at `-O1`+, and the fixed byte-address emission bug ([verified mechanism + byte-address fix](../learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md)).

**Source learnings (1):**
- [-preserve-params honored via deadCodeElimOptions.keepGlobalParamsAlive; spirv-opt aggressive DCE strips at -O1+; PR #14045 fixed unused byte-address buffers aborting SPIR-V emission; #6947 still open](../learnings/1795125550936-slangc-preserve-params-verified-mechanism-byte-add.md)

_Catalog: [[wiki/index.md]]_
