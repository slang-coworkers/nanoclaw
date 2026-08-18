---
title: "Granular SpvOpt pass selection — RegisterPassesFromFlags is the clean primitive (issue #12204)"
type: learning
topic: misc
source: learnings/1784829679560-granular-spvopt-pass-selection-registerpassesfromf.md
---

# Granular SpvOpt pass selection — RegisterPassesFromFlags is the clean primitive (issue #12204)

**Context:** shader-slang/slang#12204 asks to let users select individual SPIR-V optimization passes instead of only the `-OX` (0..3) presets.

**Key facts (verified @HEAD e438c5aef):**
- The `-OX` levels are hard-coded pass *presets*: a `switch (optimizationLevel)` in `source/slang-glslang/slang-glslang.cpp:316` with ~40 hand-unrolled `optimizer.RegisterPass(spvtools::Create*Pass())` calls across `#if 0/#elif 1/#else` branches.
- The level crosses the slang↔slang-glslang **C ABI** as the single `unsigned optimizationLevel` field of the *versioned* `glslang_CompileRequest_1_2` (`slang-glslang.h:105`; versioned chain 1_0→1_1→1_2 with `set()` copy-forward). Set at `slang-glslang-compiler.cpp:275`. So adding a custom-pass string requires a **new `glslang_CompileRequest_1_3`** field — the ABI pattern is well-established and routine.
- CLI parse: `OptionKind::Optimization` in `slang-options.cpp` (registered :836, parsed :3589).

**The clean primitive:** bundled SPIRV-Tools already exposes `spvtools::Optimizer::RegisterPassesFromFlags(const std::vector<std::string>& flags)` at `external/spirv-tools/include/spirv-tools/optimizer.hpp:140` (and `RegisterPassFromFlag` :162). It takes spirv-opt CLI-style flags (`--eliminate-dead-code-aggressive`, `-O`, `-Os`, `--legalize-hlsl`) and maps them to passes — SPIRV-Tools owns the flag vocabulary, so **no hand-maintained string→Create*Pass table is needed**. Comments at slang-glslang.cpp:376/:450 already *mention* this API but the code doesn't use it. Don't reinvent a pass-name mapping — delegate to `RegisterPassesFromFlags`.

**Two viable CLI surfaces (both need the same ABI field, so it's a UX call not a cost call):** (A) a new first-class flag reusing the `-capability a+b` split idiom (`StringUtil::split('+', ...)` slang-options.cpp:3293); (B) wire the existing `-Xspirv-opt <arg>` DownstreamArgs passthrough into the optimize path — `spirv-opt` is already a registered passthrough target (`SLANG_PASS_THROUGH_SPIRV_OPT`), but its args do **not** currently reach `glslang_optimizeSPIRV`.

**Caveat to flag in any design discussion:** exposing spirv-opt's flag vocabulary as a Slang CLI surface ties it to the bundled SPIRV-Tools version — a portability/stability commitment the maintainers must accept deliberately.

**Reminder:** spirv-opt is size/perf-only, not correctness (correctness is IR legalization) — so granular pass control is safe to expose without correctness risk, and `-O0` remains a faithful "no spirv-opt" proxy.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784829679560-granular-spvopt-pass-selection-registerpassesfromf.md`_
