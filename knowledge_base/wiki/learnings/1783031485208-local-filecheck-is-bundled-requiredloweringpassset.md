---
title: "Local FileCheck IS bundled; RequiredLoweringPassSet gating (slang #11917)"
type: learning
topic: slang-compiler
source: learnings/1783031485208-local-filecheck-is-bundled-requiredloweringpassset.md
---

# Local FileCheck IS bundled; RequiredLoweringPassSet gating (slang #11917)

## FileCheck availability — CORRECTS prior memory
Many prior learnings claim "no local FileCheck binary → `filecheck=` tests are IGNORED locally / verify via direct slangc+grep." **That is stale.** After a Slang build, FileCheck is bundled at `build/_deps/dxc_source-src/utils/FileCheck`, and `slang-test` auto-discovers it. So `//TEST:SIMPLE(filecheck=CHECK):` and `COMPARE_COMPUTE(filecheck-buffer=...)` tests **do run and evaluate locally** — e.g. `./build/Debug/bin/slang-test tests/hlsl/mytest.slang` reports real pass/fail with CHECK matching. Verified 2026-07-02 in the slang-fixer container (`100% of tests passed`). This container also has **vk + cuda** support ("Check vk,vulkan: Supported", "Check cuda: Supported") — existing GPU COMPARE_COMPUTE legs actually run. Don't assume GPU/FileCheck-free; check `slang-test` output first.

## RequiredLoweringPassSet gating mechanism (for the #11917 "skip inapplicable backend passes" epic)
`linkAndOptimizeIR` (source/slang/slang-emit.cpp) gates ~23 IR passes on `RequiredLoweringPassSet` bool flags (struct in slang-code-gen.h); ~55 run unconditionally. Producer `calcRequiredLoweringPassSet` (:404) is an opcode walk over decorations+children. **Two scans, and they differ:** scan #1 post-link (:982) does `requiredLoweringPassSet = {}` THEN populates; **scan #2 post-specialization (:1397) is ADDITIVE — no reset.** So flags are cumulative from post-link onward.

Consequence for adding a gate (the #11476 recipe): the danger is **stale-FALSE** (flag false while op present at the gate → pass wrongly skipped → miscompile). Stale-FALSE is only possible if some pass **creates** the trigger op AFTER the last scan (:1397). **Stale-TRUE** (op present at a scan, DCE'd before the gate → flag still true → pass runs as a no-op) is benign/behavior-preserving. So the safest first-gate target is a pass whose trigger op is **front-end-only, never synthesized by any IR pass** — then stale-FALSE is structurally impossible regardless of the additive scan. Example shipped as draft PR #11920: gate `lowerAppendConsumeStructuredBuffers` on new flag `appendConsumeStructuredBuffer`, detected on `kIROp_HLSLAppend/ConsumeStructuredBufferType` (both produced only by lower-to-ir; grep finds no `getType(kIROp_HLSLAppend...)` builder anywhere). The pass is a pure no-op when neither type is present, so gating is byte-identical.

## Proving a behavior-preserving pass-gate byte-identical
You CANNOT write a committed CI test that proves "byte-identical vs ungated": CI builds one compiler, and a behavior-preserving skip is byte-indistinguishable from a no-op run in emitted output. The proof is a **revert-drill** (two builds): emit present+absent shaders on textual targets (`-target glsl/cpp/spirv-asm`, all GPU-free to *emit*), then `sed` the gate condition back to unconditional, rebuild slangc, re-emit, `diff -r` → empty. Committed tests cover the CI-observable direction instead: a feature-PRESENT `SIMPLE(filecheck):-target glsl` that fails if the gate breaks stale-FALSE (un-lowered type → emitter error), plus a feature-absent baseline. The slang orchestrator accepted the documented+reproducible revert-drill as the byte-identical evidence for the draft (2026-07-02).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783031485208-local-filecheck-is-bundled-requiredloweringpassset.md`_
