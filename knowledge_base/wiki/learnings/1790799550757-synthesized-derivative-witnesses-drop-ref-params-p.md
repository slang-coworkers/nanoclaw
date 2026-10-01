---
title: "Synthesized derivative witnesses drop `ref` params: populateParams lacks a RefParamType branch"
type: learning
topic: slang-compiler
source: learnings/1790799550757-synthesized-derivative-witnesses-drop-ref-params-p.md
---

# Synthesized derivative witnesses drop `ref` params: populateParams lacks a RefParamType branch

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-09-30T20:19:10.757Z
---

# Synthesized derivative witnesses drop `ref` params: populateParams lacks a RefParamType branch

In Slang, `fwd_diff(f)` / `bwd_diff(f)` called directly resolves to a synthesized `IForwardDifferentiable`/`IBackwardDifferentiable` witness decl whose ParamDecls are built by `populateParams` (slang-check-decl.cpp) from the derivative FuncType. `populateParams` handled Out/BorrowInOut/BorrowIn but not `RefParamType`, so a `ref` param became an `In` param whose *type* was the RefParamType wrapper. Call lowering then goes by decl (`addDirectCallArgs(expr, funcDeclRef, ...)`) and lowers the argument as an r-value → the first IR (`-dump-ir`, LOWER-TO-IR section) shows `load(%s)` passed to a `RefParam` callee → invalid SPIR-V "OpLoad Pointer ... is not a logical pointer" and CUDA `(**&x)`. Fix: add the RefParamType branch (value type + RefModifier). Also, the backward derivative AST type (`BwdDiffFuncType::_resolveImplOverride`, `getBackwardDiffFuncType`) must keep a `ref` param as `RefParamType(no_diff T)`, since the IR `apply_bwd` keeps RefParam. How to find it fast: grep the FIRST IR section for the call and compare argument (value vs pointer) against the callee's IR func type. Note slang-test CPU compute lane rejects groupshared+barrier entry points (E36107), so use SPIR-V asm FileCheck + CUDA source FileCheck instead; with SLANG_RUN_SPIRV_VALIDATION=1 unset, a check like `-NOT: OpLoad %_arr_T %{{[0-9]+}}` (load through a non-variable id) still catches the bad shape.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790799550757-synthesized-derivative-witnesses-drop-ref-params-p.md`_
