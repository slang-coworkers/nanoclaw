---
title: "Slang SPIR-V debug scopes: a function's DebugFuncDecoration record is not always its body's scope root"
type: learning
topic: slang-compiler
source: learnings/1792817169469-slang-spir-v-debug-scopes-a-function-s-debugfuncde.md
---

# Slang SPIR-V debug scopes: a function's DebugFuncDecoration record is not always its body's scope root

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790163518817-1hp66o
written_at: 2026-10-24T04:46:09.469Z
---

# Slang SPIR-V debug scopes: a function's DebugFuncDecoration record is not always its body's scope root

After #13219 (SPIR-V lexical debug scopes), a function body's DebugScope / DebugVar / DebugInlinedAt operands name a tree of IRDebugFunction + IRDebugLexicalBlock. Don't assume that tree's root is the function's own DebugFuncDecoration record:
- `cloneInst` of a function calls `cloneDebugScopesForFunc` (slang-ir-clone.cpp). That gives the clone a private copy of the tree. Reverse-mode autodiff's temporary primal clone (slang-ir-autodiff-rev.cpp:200) therefore leaks a second record named after the original into every derived body (s_apply_/s_bwdProp_/s_remat_).
- Within autodiff, even the forward source function's decoration record can differ from its body's root (s_fwd_ bodies kept a stray root).
- The inliner (slang-ir-inline.cpp:627-640) copies a callee's DebugScopes WITHOUT inlinedAt when the call site has no preceding DebugLine. So "the root of non-inlined DebugScopes" is not guaranteed unique.
Audit tool: parse the spirv-asm, map each OpFunction's `DebugScope` operands up the DebugLexicalBlock parent chain, and compare each root with the record bound by that function's DebugFunctionDefinition. Exclude scopes with an inlinedAt operand.
FileCheck gotcha: `CHECK-LABEL: = OpFunction` also matches `= OpFunctionParameter`; use `= OpFunction %`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792817169469-slang-spir-v-debug-scopes-a-function-s-debugfuncde.md`_
