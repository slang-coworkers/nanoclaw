---
title: "Stale prebuilt slangc + inlining mask SPIR-V static-local bugs (verify-at-HEAD pitfalls)"
type: learning
topic: slang-compiler
source: learnings/1781708255374-stale-prebuilt-slangc-inlining-mask-spir-v-static-.md
---

# Stale prebuilt slangc + inlining mask SPIR-V static-local bugs (verify-at-HEAD pitfalls)

Triaging shader-slang/slang#11651 (function-`static` local loses state across non-inlined calls on SPIR-V/vk). Two non-obvious traps, both about "verify the repro at HEAD":

**1. A prebuilt `build/Debug/bin/slangc` can be OLDER than your freshly-reset checkout.** After `git reset --hard origin/master`, the cached binary may still be from a commit days behind HEAD. `slangc -v` prints a git-describe string `2026.10.2-N-g<sha>` — the `<sha>` is the binary's source commit. Check it against `git rev-parse HEAD` before trusting compiled output. I almost concluded "bug doesn't reproduce" from a binary built ~6h before the reporter's tested commit. (When the codegen files on the path are unchanged HEAD-vs-binary-sha, the binary still faithfully reflects HEAD for that path — but confirm the diff, don't assume.)

**2. Function-`static` SPIR-V storage-class bugs are MASKED by inlining and are NOT reproducible via `slangc -target spirv-asm`.** For a static local reached via `expand`/variadic dispatch: default/`-O1` fully inline the callee (one shared backing var → correct); `-O2` DCEs it; **`-O0` emits both the var AND its lazy-init guard as `Private` (separate function → also correct).** The buggy `counter=Function`/`guard=Private` split only appears on the `slang-test` `-shaderobj`/vk GPU pipeline. So a slangc-CLI "works for me" does NOT refute such a report. Root cause is the storage-class discontinuity documented as TODO #4742 in `slang-ir-explicit-global-context.cpp:35-37` (SPIR-V policy `addressSpaceOfLocals = AddressSpace::Function` at :52 vs default `ThreadLocal` at :129). Lowering itself is symmetric: `lowerFunctionStaticVarDecl` (`slang-lower-to-ir.cpp:11583`/:11611) creates both var and guard as `IRGlobalVar`; the guard stays Private because `moveGlobalVarInitializationToEntryPoints` (`slang-ir-explicit-global-init.cpp:245`) gives it a 2nd (entry-point) use, while the single-use counter can be sunk to Function storage.

**3. Bonus build fix:** incremental rebuild link error `undefined reference to Slang::ByteCodeInterpreter::validatePointerAccess/validateOperandAccess/validatePointerOffset` is a `SLANG_ENABLE_VALIDATION_VM_BYTECODE` mismatch between stale objects (introduced by #11309). `touch source/slang/slang-vm.cpp source/slang/slang-vm-inst-impl.cpp` then rebuild — forces both TUs to recompile with the same macro value.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781708255374-stale-prebuilt-slangc-inlining-mask-spir-v-static-.md`_
