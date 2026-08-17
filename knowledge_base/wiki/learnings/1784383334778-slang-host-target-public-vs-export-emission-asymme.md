---
title: "Slang host-target: public vs export emission asymmetry is a LINKING-ROOT gap (HLSLExportDecoration), not a KeepAlive/DCE gap"
type: learning
topic: slang-compiler
source: learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md
---

# Slang host-target: public vs export emission asymmetry is a LINKING-ROOT gap (HLSLExportDecoration), not a KeepAlive/DCE gap

**Context:** shader-slang/slang#9401. A maintainer proposed "`__extern_cpp` should have `KeepAliveDecoration`" to make `public __extern_cpp` functions emit in `-target hpp`/`cpp` output like `export __extern_cpp`. Verified on ToT (HEAD aaa07fe29) with code-trace + a Debug-build `-dump-ir` comparison. The subtle lesson: **KeepAliveDecoration is orthogonal to the linking root-set; the public/export emission asymmetry lives at the LINKER, gated on `HLSLExportDecoration`.**

**Two independent gates control whether an exported host function emits:**

**GATE 1 — public vs export = a linking-root gap (NOT DCE/KeepAlive).**
- The linker's non-entrypoint export fallback `slang-ir-link.cpp:2363` iterates `getHLSLExports()`, which collects insts carrying `HLSLExportDecoration` or `DownstreamModuleExportDecoration` ONLY (`slang-ir.cpp:5000-5015`). It NEVER checks `KeepAliveDecoration`. KeepAlive is only added *post-hoc* to already-cloned insts (`slang-ir-link.cpp:2350-2352`) or to entrypoints (`:1211`) — it is not a root condition.
- In lowering (`slang-lower-to-ir.cpp`): `export`→`HLSLExportModifier` adds BOTH `HLSLExportDecoration`+`KeepAliveDecoration` (1438-1442); `public`→`PublicDecoration` only (1434-1436); `__extern_cpp`→`ExternCppDecoration` only (1443-1445).
- **Empirical proof via `-dump-ir` (Debug build):** with an entrypoint present, `public __extern_cpp int myFunc` → `externCpp("myFunc")` appears ONCE in pre-link IR then VANISHES from every later pass; `export __extern_cpp` → persists ~76× including the final module. So `public __extern_cpp` is dropped at LINK, not at emit.
- **Therefore adding KeepAlive alone does NOT fix it** — to make `__extern_cpp` root like `export`, the `ExternCppModifier` arm must also add `HLSLExportDecoration` (mirroring the CUDA/DLL/Torch arms at 1455-1492).

**GATE 2 — the "requires an entrypoint" requirement is SEPARATE and decoration-independent.**
- `EndToEndCompileRequest::generateOutput` (`slang-end-to-end-request.cpp:733-751`): if `GenerateWholeProgram` (`-whole-program`) → whole-program result; ELSE loop over entry points. With 0 entrypoints AND no `-whole-program`, NEITHER branch runs, so the linker export fallback is never even reached → empty output.
- Proof it's decoration-independent: `export __extern_cpp` ALREADY carries HLSLExport+KeepAlive yet emits nothing with no entrypoint + no `-whole-program`; `-whole-program` (populates all entry-point indices) emits it with no entrypoint. So no decoration change removes this gate — `-whole-program` is the existing answer.

**Method lesson:** when a maintainer proposes a specific decoration fix, verify WHERE the gate actually is (root collection vs DCE vs output-generation) before implementing — a plausible one-liner can be necessary-but-insufficient or aimed at the wrong layer. `-dump-ir` "appears once then vanishes" vs "persists to final module" is a fast way to distinguish a linking-drop from an emit-filter-drop.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784383334778-slang-host-target-public-vs-export-emission-asymme.md`_
