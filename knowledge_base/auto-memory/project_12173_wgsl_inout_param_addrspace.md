---
name: project_12173_wgsl_inout_param_addrspace
description: "IN-FLIGHT slang#12173 WGSL inout-param address-space mismatch — triaged P2, routed to fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc5b59cf-179e-4a37-8843-3167881a479a
---

# shader-slang/slang#12173 — WGSL: invalid output for fn with inout param

**State (2026-07-21):** fix in **draft PR #12174** (`Closes #12173`, triager-verified independently). slang-TRIAGER owns E2E chain. Verified 5-bullet verdict posted to GitHub (comment 5033975589, refreshed in place); `reproduced` label applied; [Triage Resolution] forwarded to me. HELD per drafts-only guardrail — triager holds until #12174 goes non-draft + merge (or substantive human comment), then refreshes verdict in place + forwards final resolution. Canonical thread `gh-issue-shader-slang/slang-12173`. Author skiminki-nv (contributor, NVIDIA). Labels: Dev Opened, WebGPU.
**Watch:** confirm fixer called `report_pr_created({shader-slang/slang, 12174})` so PR webhooks route to its session (my verify-report_pr_created rule). Triager instructed it to.

**⚠️ My topology error (corrected):** I dispatched to slang-fixer DIRECTLY last turn AND routed to the triager — but the triager owns the triage→fix handoff. Double-dispatch risk (two fixer sessions racing). Consolidated: triager owns the fixer dispatch + consolidation; my direct dispatch is redundant. Lesson: for GitHub ISSUE webhooks, route to triager ONLY — it forwards to fixer. Do NOT also dispatch to fixer.

**Bug:** WGSL codegen emits fn with `inout`/`out` param as `ptr<function,T>`, but a global `static` arg lowers to `var<private>` ⇒ call site passes `ptr<private,T>` into `ptr<function,T>` param. Invalid WGSL (naga rejects address-space mismatch). TEXT-emission target, no GPU needed to repro.

**Root cause:** `source/slang/slang-ir-wgsl-legalize.cpp:46-55` — `legalizeCall`'s copy-in/copy-out skip-list unconditionally `continue`s for `kIROp_Var/Param/GlobalParam/GlobalVar`. A global static = `kIROp_GlobalVar` (Private) gets skipped → passed straight through. Skip-list keys on "is whole addressable object" but ignores ADDRESS-SPACE dimension. Block-local `kIROp_Var` is already Function-space (correct to skip); bug is the global-scope entries.

**Recommended fix (Approach A):** narrow the skip-list so global-scope pointer args (not already `AddressSpace::Function`) fall through to the existing :57-71 temp path (function-space local, copy-in via emitLoad/emitStore, pass temp, writeback after call). Discriminate by IR op/scope — address space isn't assigned yet at legalizeCall time (`specializeAddressSpaceForWGSL` runs later at slang-emit.cpp:2441; legalizeIRForWGSL at :2208). Approach B (author's per-callsite fn duplication per addr-space) = zero copy overhead but adds function duplication WGSL deliberately avoids; flag as reviewer alternative.

**Fixer must:** confirm `out`-only params + ternary/`select`-guarded calls covered; add filecheck regression test (assert call passes `ptr<function>` temp, not `&(global)`). Draft PR only.

**Dependency:** author asks — once fixed, ENABLE WGPU testing for `tests/language-feature/scalar-ternary-op-short-and-non-short-circuit.slang` (currently in PR #12163). Coordinate/note in fix PR.

**Dedup:** NOVEL. Not #11669 (unrelated GetDimensions). Same FAMILY as #8183/#11981 (Metal Generic-addrspace crashes) but distinct — WGSL mismatch, not crash. #12163 is doc PR that surfaced it, not a fix.
