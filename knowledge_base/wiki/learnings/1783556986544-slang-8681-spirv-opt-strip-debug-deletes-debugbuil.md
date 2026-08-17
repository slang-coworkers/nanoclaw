---
title: "slang#8681 spirv-opt strip-debug deletes DebugBuildIdentifier — separate-debug-info needs a DBI shim"
type: learning
topic: slang-compiler
source: learnings/1783556986544-slang-8681-spirv-opt-strip-debug-deletes-debugbuil.md
---

# slang#8681 spirv-opt strip-debug deletes DebugBuildIdentifier — separate-debug-info needs a DBI shim

**Context:** Triaging shader-slang/slang#8681 (jkwak refactor: replace hand-rolled `stripDbgSpirvFromArtifact` with spirv-opt `--strip-debug`/`--strip-nonsemantic`). Verified at HEAD d8e8e1a9e.

**The gotcha (load-bearing, refutes the issue's own premise):** You CANNOT just delete `stripDbgSpirvFromArtifact` (`source/slang/slang-emit.cpp:2980-3122`) and call spirv-opt. That function is the **`-separate-debug-info` splitter** (sole caller: `slang-emit.cpp:3322-3327`, inside `shouldEmitSeparateDebugInfo()`), and it hand-rolls the strip precisely so it can keep ONE thing: the `DebugBuildIdentifier` ext-inst + the `OpString` it references (`:3051-3119`). The DBI is the hash linking the stripped main module to its `.dbg.spv` — it MUST stay in the main module.

**Why spirv-opt breaks it:** `CreateStripDebugInfoPass` (external/spirv-tools/source/opt/strip_debug_info_pass.cpp:79) unconditionally kills ALL of `module()->ext_inst_debuginfo()`, and the loader routes every `NonSemantic.Shader.DebugInfo.100` ext-inst — INCLUDING DebugBuildIdentifier — into that list (ir_loader.cpp:358-360). `CreateStripNonSemanticInfoPass` additionally removes all `NonSemantic.*` OpExtInstImport (strip_nonsemantic_info_pass.cpp:84-90). **Either pass deletes the DBI.** Regression guard `tests/spirv/separate-debug.slang` (`CHECK: DebugBuildIdentifier` + `CHECK-NOT` on all other debug insts) fails on a naive swap.

**Ordering fact (jkwak's stated understanding was wrong):** DBI is created as IR inst at `slang-emit.cpp:959-966` and emitted at `slang-emit-spirv.cpp:2210` BEFORE base SPIR-V emit; spirv-opt optimize runs; THEN the split strips. Nothing re-adds the DBI after stripping. So "we add DBI after stripping so it's unaffected" does not match the code.

**Correct shape:** hybrid — new `glslang_stripDebugAndNonsemantic` export in slang-glslang + `m_stripDebugNonsemantic` pointer wired in slang-glslang-compiler.cpp:88-100, spirv-opt owns the bulk strip, but a thin Slang shim must exempt/re-inject the DBI (+ its OpString + the NonSemantic.Shader.DebugInfo.100 import that strip-nonsemantic removes). The DBI exemption is irreducible — spirv-opt has no "keep DBI" knob.

**Don't confuse** with `source/slang/slang-ir-strip-debug-info.cpp::stripDebugInfo()` — that's an IR-LEVEL pass (for -g0), unrelated to the SPIR-V separate-debug split; it DOES list kIROp_DebugBuildIdentifier as removed (:20) but runs in a different path.

Prior attempt: closed Copilot PR #8682 (jkwak wanted a redo with a newer LLM). Feature origin: PR #7178.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783556986544-slang-8681-spirv-opt-strip-debug-deletes-debugbuil.md`_
