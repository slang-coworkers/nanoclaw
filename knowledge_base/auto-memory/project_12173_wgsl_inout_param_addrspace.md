---
name: project_12173_wgsl_inout_param_addrspace
description: "TERMINAL slang#12173 WGSL inout-param address-space mismatch — fixed+merged #12174 07-22 (d384b77e66)"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc5b59cf-179e-4a37-8843-3167881a479a
---

# shader-slang/slang#12173 — WGSL: invalid output for fn with inout param

**✅ TERMINAL (2026-07-22):** RESOLVED. PR #12174 MERGED by human/issue-author skiminki-nv, merge commit `d384b77e66` @ 12:59:03Z; issue CLOSED/COMPLETED @ 12:59:04Z. Verified-infra windows-gpu CI red (step-6 setup abort) merged over — confirmed non-code. Issue verdict (comment 5033975589) refreshed in place to "fixed, merged in #12174". Chain CLOSED under slang-triager; re-opens only on fresh substantive human comment.
**Final fix (refined from triage):** `legalizeCall` (`source/slang/slang-ir-wgsl-legalize.cpp`) bridges a module-scope pointer arg through a function-space copy-in/writeback temp **only when the callee param is `out`/`inout`** — the discriminator is the param's PASSING MODE, not the arg's IR op (as the triage memo had proposed keying on kIROp_GlobalVar). `ref`/borrow (e.g. `workgroupUniformLoad`) still pass the caller's object directly. +regression test `tests/wgsl/inout-global-static.slang`. 0 emission diffs vs master across all 165 WGSL tests except the repro; codex approved.
**Follow-up:** WGPU test enable for `scalar-ternary-op-short-and-non-short-circuit.slang` is sequenced by PR #12163, NOT this chain.

---

**State (2026-07-22):** fix in **PR #12174** (`Closes #12173`, Approach A). **NON-DRAFT + `reviewDecision: APPROVED`** — human/issue-author skiminki-nv (CONTRIBUTOR) flipped ReadyForReview 08:41:42Z + APPROVE 08:41:31Z 07-22, by their own hand (drafts-only guardrail satisfied, no bot action; same pattern as #12115/szihs). slang-TRIAGER owns E2E chain; verified 5-bullet verdict on GitHub (comment 5033975589); `reproduced` label applied. Triager now **holds the issue-verdict refresh for the MERGE itself** (merge-is-the-trigger, #12115 lesson — no mid-review churn); non-draft approved PR is the public artifact of record. slang-reviewer internal verdict still in flight (advisory now a human approved). On merge: triager refreshes 5033975589 in place + forwards final [Triage Resolution]. Canonical thread `gh-issue-shader-slang/slang-12173`. Labels: Dev Opened, WebGPU.
**Blocker (07-22 10:12Z):** CI red on #12174 is **verified-infra** by triager (CI run 29904991503 @head 20abf012ce = 34✓/2✗/1skip): failing `test-windows-release-cl-x86_64-gpu / test-slang` aborted at step 6 "Common Test Setup" — steps 7-12 (Test Slang / slangc tests / via-glsl) all SKIPPED, no assertion/FileCheck failure; 2nd red = `check-ci` rollup. All 8 builds + every other platform (incl. sibling windows-gpu-rhi test-slang-rhi) PASSED. A WGSL-emit change can't reach a Windows-GPU test-execution path — reasoning sound. Bot lacks rerun rights (`gh run rerun --failed` → "Must have admin rights"); no-op push would dismiss author approval → bot can't self-heal. **Human action to clean-green:** admin runs `gh run rerun 29904991503 --failed`, OR maintainer merges past known-infra red. No auto-retry fired as of 10:11Z. Surfaced to operator (orchestrator-dashboard) 07-22.

**⚠️ My topology error (corrected):** I dispatched to slang-fixer DIRECTLY last turn AND routed to the triager — but the triager owns the triage→fix handoff. Double-dispatch risk (two fixer sessions racing). Consolidated: triager owns the fixer dispatch + consolidation; my direct dispatch is redundant. Lesson: for GitHub ISSUE webhooks, route to triager ONLY — it forwards to fixer. Do NOT also dispatch to fixer.

**Bug:** WGSL codegen emits fn with `inout`/`out` param as `ptr<function,T>`, but a global `static` arg lowers to `var<private>` ⇒ call site passes `ptr<private,T>` into `ptr<function,T>` param. Invalid WGSL (naga rejects address-space mismatch). TEXT-emission target, no GPU needed to repro.

**Root cause:** `source/slang/slang-ir-wgsl-legalize.cpp:46-55` — `legalizeCall`'s copy-in/copy-out skip-list unconditionally `continue`s for `kIROp_Var/Param/GlobalParam/GlobalVar`. A global static = `kIROp_GlobalVar` (Private) gets skipped → passed straight through. Skip-list keys on "is whole addressable object" but ignores ADDRESS-SPACE dimension. Block-local `kIROp_Var` is already Function-space (correct to skip); bug is the global-scope entries.

**Recommended fix (Approach A):** narrow the skip-list so global-scope pointer args (not already `AddressSpace::Function`) fall through to the existing :57-71 temp path (function-space local, copy-in via emitLoad/emitStore, pass temp, writeback after call). Discriminate by IR op/scope — address space isn't assigned yet at legalizeCall time (`specializeAddressSpaceForWGSL` runs later at slang-emit.cpp:2441; legalizeIRForWGSL at :2208). Approach B (author's per-callsite fn duplication per addr-space) = zero copy overhead but adds function duplication WGSL deliberately avoids; flag as reviewer alternative.

**Fixer must:** confirm `out`-only params + ternary/`select`-guarded calls covered; add filecheck regression test (assert call passes `ptr<function>` temp, not `&(global)`). Draft PR only.

**Dependency:** author asks — once fixed, ENABLE WGPU testing for `tests/language-feature/scalar-ternary-op-short-and-non-short-circuit.slang` (currently in PR #12163). Coordinate/note in fix PR.

**Dedup:** NOVEL. Not #11669 (unrelated GetDimensions). Same FAMILY as #8183/#11981 (Metal Generic-addrspace crashes) but distinct — WGSL mismatch, not crash. #12163 is doc PR that surfaced it, not a fix.
