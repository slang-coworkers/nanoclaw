---
title: "SPIR-V DebugEntryPoint command-line string: two roots (hardcoded -g2 + no-default serializer switch)"
type: learning
topic: slang-compiler
source: learnings/1784915879616-spir-v-debugentrypoint-command-line-string-two-roo.md
---

# SPIR-V DebugEntryPoint command-line string: two roots (hardcoded -g2 + no-default serializer switch)

shader-slang/slang#12220 (reproduced @HEAD 5281ccc66). The command-line string embedded in the SPIR-V `NonSemantic.Shader.DebugInfo.100` `DebugEntryPoint` OpString is built by `getDebugInfoCommandLineArgumentForEntryPoint()` (`source/slang/slang-emit-spirv.cpp:3956-3970`). Two independent accuracy bugs:

1. **Misreported debug level.** The function ends with a LITERAL `sb << " -g2";` (line 3968) — it never reads the requested level. The accessor `CompilerOptionSet::getDebugInfoLevel()` (`slang-compiler-options.h:428-431`; enum `DebugInfoLevel {None=0,Minimal=1,Standard=2,Maximal=3}` in `slang-compiler.h:110-116`) already exists but is unused, so `-g3` still emits `-g2`.

2. **Dropped options.** The rest of the string comes from `CompilerOptionSet::writeCommandLineArgs()` (`slang-compiler-options.cpp:44-180`), a `switch(option.key)` with **no `default` case**. Any option kind without an explicit case is silently skipped — that's why `-lang` (Language), `-profile` (Profile), `-gdwarf` (DebugInformation format), `-minimum-slang-optimization` (MinimumSlangOptimization), `-line-directive-mode` (LineDirectiveMode) vanish while `-O0`/`-matrix-layout` (which DO have cases) survive.

Fix = serialize the missing descriptive options in `writeCommandLineArgs` (incl. DebugInformation→`-g<level>`+`-gdwarf`) AND delete the hardcoded `-g2` at emit site so level flows from one source (else `-g` doubles).

Gotchas verified: (a) `writeCommandLineArgs` is ALSO called by the CPU/LLVM emit path (`slang-emit-llvm.cpp:726`) — serializer edits widen that string too. (b) Module-cache hashing is a SEPARATE method `CompilerOptionSet::buildHash` (`slang-compiler-options.cpp:182`) that iterates `options` directly, NOT via writeCommandLineArgs → serializer edits do NOT change cache digests. (c) Prior art: #6108/PR#6114 was an earlier fix in this same function (empty stringValue → invalid DebugEntryPoint).

Repro without a disassembler: `spirv-asm` needs glslang's disassembler which may not load in the container. Emit raw `-target spirv -o x.spv` and `strings x.spv | grep -- '-target spirv'` — the OpString is stored verbatim in the binary, so the command-line string is directly greppable.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784915879616-spir-v-debugentrypoint-command-line-string-two-roo.md`_
