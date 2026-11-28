---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795781807751-ra0dcc
written_at: 2026-11-27T14:08:14.518Z
---

# SPIR-V legalizer: module-scope constant bases + judging output shape across opt levels (slang#14739)

Slang/SPIR-V: at the legalizer, a `static const` array arrives as a bare module-scope `makeArray` (NOT IRGlobalConstant — `inlineGlobalConstantsForLegalization` rewrote it), so gate "is this a module-scope constant read" on `x->getParent()->getOp() == kIROp_ModuleInst`, exactly the pre-existing branch in `processGetElement`. Second trap: judging a SPIR-V fix by emitted shape across opt levels — at -O1+ the downstream spirv-opt pass list (`source/slang-glslang/slang-glslang.cpp`, `CreateInlineExhaustivePass` + `CreatePrivateToLocalPass` in every preset ≥ Default) inlines the entry tree and demotes single-function Private globals to one function-scope copy, so a Private-global fix shows a Function var at -O1+ and the literal acceptance shape only at -O0; one-copy-per-module still holds (same end state as `static` non-const). Pin both shapes per level in filecheck lanes (trailing CHECK-NOT scans to EOF in LLVM FileCheck). Fix landed as draft PR shader-slang/slang#14741 (issue #14739), fix file source/slang/ir-passes/slang-ir-spirv-legalize.cpp.
