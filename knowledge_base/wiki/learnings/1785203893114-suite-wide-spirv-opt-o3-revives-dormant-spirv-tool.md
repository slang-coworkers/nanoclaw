---
title: "Suite-wide spirv-opt (-O3) revives dormant SPIRV-Tools asserts (#12247, revives #11766/#11767)"
type: learning
topic: slang-compiler
source: learnings/1785203893114-suite-wide-spirv-opt-o3-revives-dormant-spirv-tool.md
---

# Suite-wide spirv-opt (-O3) revives dormant SPIRV-Tools asserts (#12247, revives #11766/#11767)

**Context:** Triaging shader-slang/slang#12247 — "slang-test -O3 has 79 failures when spirv-opt enabled suite-wide". jkwak self-filed+self-assigned (→ triage+verdict is terminal deliverable, no fixer).

**Key non-obvious facts (verified @ HEAD 15863db48, spirv-tools submodule 0d6fd73c, L40S):**

1. **The `-O0`-default (PR #11805) masks real compiler-path aborts, it doesn't fix them.** slang-glslang.cpp:275 early-outs at SLANG_OPTIMIZATION_LEVEL_NONE, so spirv-opt never runs in normal CI. Forcing `-O1/-O2/-O3` (same registered pass list, slang-glslang.cpp:334-372) resurrects any latent spirv-opt assert. This is why #11766/#11767 (fp8 folding abort) were closed COMPLETED and the `scalar-fp8.slang (vk)` expected-failure entry removed (#11922) — NOT because spirv-tools was fixed (it wasn't), but because the abort stopped firing under -O0. #12247's suite-wide-opt scenario revives them. Lesson: a "resolved" spirv-opt issue closed around the #11805 era may just be dormant.

2. **Debug-build `assert()`→`abort()` bypasses Slang's graceful optimizer-diagnostic path.** DeepWiki + code confirm the messageConsumer/`SLANG_FAIL` path only catches SOFT `Optimizer::Run()==false`. A C++ assert inside a spirv-opt pass calls abort() first → process dies. On Windows this masquerades as "exit code 3 / no diagnostic / hang >60s / lost JSON-RPC test-server worker"; on Linux it's a clean SIGABRT(134). So "lost worker / hang" reports in optimized batches are often a sibling test's hard abort killing the shared worker — verify each suspect standalone before believing it's its own bug.

3. **Two live spirv-opt assert sites for exotic Slang types/constructs:**
   - fp8 (FloatE4M3/E5M2, 8-bit) + CoopVec<float> constants → float folder asserts: `folding_rules.cpp:156` (GetWordsFromScalarFloatConstant, width∈{16,32,64}) and `:3539` (getFloatConstantKind). Note the sibling INT folder `:142` accepts width 8 — only float is gapped.
   - `spirv_asm{}` emitting `OpMemberDecorateIdEXT`/`OpMemberDecorateId` → `aggressive_dead_code_elim_pass.cpp:1000` `default: assert(false)` (annotation switch 908-1002 has no case for it). spirv_asm output DOES flow through spirv-opt.

4. **Triage-classification shortcut:** for a big "N tests fail under opt" list, compile a sample at `-O3` with the test's REAL `-entry`/`-stage` flags. EXIT=0 = benign FileCheck drift (opt legally rewrote output → fix is test-side: pin pre-opt or use spirv-val/relaxed checks). EXIT=134 = real abort worth a sub-issue. ~77 of 79 here were benign; 2 real + 2 collateral.

Precedent for fix: `SLANG_ENABLE_SPIRV_OPT_MERGE_RETURN` CMake toggle already conditionally skips a known-bad pass; #12204 notes RegisterPassesFromFlags as the clean granular-pass primitive.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785203893114-suite-wide-spirv-opt-o3-revives-dormant-spirv-tool.md`_
