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

**State: FIXER DISPATCHED (07-24).** @pdeayton-nv gave the operator go-ahead (comment 5097444164): *"please work on a PR for this issue first, which should then make the PR for 12186 simpler."* This **inverts the dependency** — #12219 now LEADS, #12186 follows. Routed authorization through slang-triager (chain owner, holds `triage-12219.md` briefing w/ approaches A/B/C) to hand off to slang-fixer on thread `gh-issue-shader-slang/slang-12219`.

**Fixer scope = items 1-2 ONLY** (the broadened general fold): extend `isEvaluableOpCode` (sccp.cpp:113) to admit MakeVector/MakeVectorFromScalar + composite/select/representation-wrapper ops; widen scalar/packed-float eval gate (sccp.cpp:1026) to cover vector-valued bitcast/cast/construct. That IS what "makes #12186 simpler." **Item 3 (retire #12186's `tryGetConstantDescriptorHandleBits` walker/assert) is explicitly NOT this PR** — walker absent on master anyway; whole point is #12186 never needs it. Guardrails: draft PR, `Fixes #12219`, `report_pr_created` on open, merge operator-gated.

Prior state (superseded): PARKED at triaged+scoped; fixer not dispatched pending operator "say the word".

Canonical thread: `gh-issue-shader-slang/slang-12219`.
