---
title: "-Xspirv-opt is structurally unreachable for text targets (one call site, SPIR-V-only) — and --strip-debug keeps Slang reflection working"
type: learning
topic: slang-compiler
source: learnings/1785954407063-xspirv-opt-is-structurally-unreachable-for-text-ta.md
---

# -Xspirv-opt is structurally unreachable for text targets (one call site, SPIR-V-only) — and --strip-debug keeps Slang reflection working

While handling maintainer direction on shader-slang/slang#12313, verified at master b0e43d657 (source read + measured with Debug slangc):

**1. `-Xspirv-opt` cannot affect any text target — structurally, not just in practice.**
There is exactly ONE `getDownstreamArgs("spirv-opt")` call site in the whole tree: `source/slang/slang-emit.cpp:3385` (feeds `needsOptimization` :3386-3389 → `getOrLoadDownstreamCompiler(PassThroughMode::SpirvOpt)` :3398-3402). It lives in `static createArtifactFromIR` (:3291), whose ONLY caller is `emitSPIRVForEntryPointsDirectly` (:3522), reached ONLY from `case CodeGenTarget::SPIRV` + `shouldEmitSPIRVDirectly()` at `slang-code-gen.cpp:1184-1189`. Text targets (GLSL/HLSL/CUDASource/CUDAHeader/CPPSource/CPPHeader/HostCPPSource/PyTorchCppBinding/CSource/Metal/WGSL) are DISJOINT cases of the same `switch(target)` in `_emitEntryPoints` at `slang-code-gen.cpp:1282-1292` → `emitEntryPointsSourceFromIR` (`slang-code-gen.cpp:165`), which never reads spirv-opt args.

**2. The GUILTY CONTROL is what makes this dispositive — a null alone would have been weak.** Pass a deliberately-invalid pass name:
- `-target spirv -Xspirv-opt definitely-not-a-pass` ⇒ `spirv-opt: error: definitely-not-a-pass is not a valid flag`, exit 255 ⇒ genuinely parsed + forwarded.
- `-target hlsl -Xspirv-opt definitely-not-a-pass` ⇒ **no diagnostic, exit 0** ⇒ silently accepted and discarded.
"Output byte-identical with and without the flag" is consistent with both "flag ignored" and "flag ran but changed nothing"; the invalid-name cell separates them.

**3. SPELLING: spirv-opt needs the DOUBLE dash.** `-Xspirv-opt strip-debug` ⇒ exit 255. `-Xspirv-opt --strip-debug` works. Easy to mis-copy from prose that writes pass names bare.

**4. ⭐`--strip-debug` strips names WITHOUT breaking Slang reflection** (useful anywhere IP-protection-vs-reflection comes up): OpName 5→0, symbol gone, 1000→828 B — yet `OpDecorate ... Binding`/`DescriptorSet` are untouched AND `-reflection-json` still names the params. Reason: Slang serves reflection from its own layout data, not from the SPIR-V blob's OpNames. Available: `--strip-debug`, `--strip-reflect`, `--strip-nonsemantic` (registered in `external/spirv-tools/source/opt/optimizer.cpp:324-329`).

**5. Method trap I hit: `echo "exit=$?"` after a pipe reads the LAST pipeline element's status** (`head`), not the command's. My first cell reported exit 0 for what was actually a 255 spirv-opt error. Use `${PIPESTATUS[0]}`. A defective exit capture silently converts an error into an apparent success.

Generalizable: when a maintainer points a reporter at an existing option, check the PIPELINE STAGE the option operates at against the stage the reporter's use case reaches — "is the feature implemented in tool X" can be unanswerable-as-framed rather than yes/no, if the user's path never reaches X.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785954407063-xspirv-opt-is-structurally-unreachable-for-text-ta.md`_
