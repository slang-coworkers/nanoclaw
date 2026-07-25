---
name: project-12219-sccp-module-scope-composite-const-fold
description: "#12219 SCCP: fold module-scope vector/composite constant exprs before SPIR-V emit — triaged+scoped, PARKED"
metadata: 
  node_type: memory
  type: project
  originSessionId: f1d7131c-25f1-4b0d-a50b-9a32585f50b6
---

# #12219 — SCCP: fold module-scope vector/composite constant expressions before SPIR-V emission

Split-off from review of PR #12186 (fix for [[project-12185-bindless-texture-nv-desc-handle-nonimage]]) at **@pdeayton-nv**'s request. Filed by nv-slang-bot. Label: bug.

**What:** ICE (E99997 "Unhandled global inst in spirv-emit") on valid module-scope `static const` vector/composite initializers built from float / `bit_cast` sources. Original framing was narrow (DescriptorHandle constant initializers, uint2/uint64 rep casts); **pdeayton-nv broadened scope 07-24** to the general case: *fold module-scope vector/composite constant exprs containing construction, numeric conversion, bit-casting, selection, and representation-wrapper ops before emission.*

**Root cause (verified file:line, master HEAD 5281ccc66):**
- `isEvaluableOpCode` (`slang-ir-sccp.cpp:113`) omits `MakeVector`/`MakeVectorFromScalar` + the 4 `Cast*DescriptorHandle*` rep ops.
- scalar/packed-float eval gate (`slang-ir-sccp.cpp:1026`) blocks vector-valued bitcast/cast/construct.
- Fix layer = **SCCP**, not emit. `applySparseConditionalConstantPropagationForGlobalScope` runs at global scope before emit but can't collapse these.

**Triage (slang-triager, 07-24):** EMPIRICALLY REPRODUCED on master, compile-only/no-GPU — both cases incl. capability-off. Type=Bug, `reproduced` applied. Verdict comment id **5072813775**. Title generalized + body rewritten (reproducers kept, proposed-work item 1 widened). Nuance: naive unused-const repro masked by DCE (must consume the constant); #12186's emit-time walker/assert is ABSENT on master → **proposed-work item 3 (retire the walker) is #12186-gated.**

**State: PARKED at triaged+scoped.** Fixer NOT dispatched — maintainer asked to broaden scope, not "make a PR"; reporter says non-blocking to #12186's core fix. Items 1-2 ready-for-fix on master now; item 3 blocked on #12186 merge. Briefing memo `triage-12219.md` held by slang-triager. Dispatch = operator "say the word".

Canonical thread: `gh-issue-shader-slang/slang-12219`.
