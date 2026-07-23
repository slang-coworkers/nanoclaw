---
name: project_12191_e55215_postopkill_deadcode
description: "#12191 E55215 (bindless DescriptorHandle) mis-fires in post-OpKill dead code — triaged enh/P3, PARKED for pdeayton; depends on #12186"
metadata: 
  node_type: memory
  type: project
  originSessionId: 082d5036-bea6-4dc0-b387-cd1e9a9d206c
---

# #12191 — spvBindlessTextureNV E55215 diagnosed in post-OpKill dead code

**Repo:** shader-slang/slang · **Author:** nv-slang-bot[bot] (our own coworker) · opened 2026-07-22
**Canonical thread:** `gh-issue-shader-slang/slang-12191` · Labels: Diagnostics, spirv_vulkan

Follow-up filed during review of PR #12186 (fix for [[project_12185_bindless_texture_nv_desc_handle_nonimage]]).
Deferred by @pdeayton-nv as a consolidated cleanup, NOT folded into the bug-fix PR.

## Mechanism (triager-confirmed by code inspection)
`maybeDiagnoseUnsupportedBindlessDescriptorHandleConversion` fires from the legalization
worklist (`case kIROp_CastDescriptorHandleToResource`) — BEFORE
`removeUnreachableCodeAfterDiscardForOpKill` + `eliminateDeadCode` in `legalizeIRForSPIRV`
(`slang-ir-spirv-legalize.cpp` ~3258/3356). So a `DescriptorHandle→resource` cast stranded in a
post-`OpKill` dead block (SPIR-V <1.6, no `SPV_EXT_demote_to_helper_invocation`, where `discard`
→ terminator `OpKill`) is diagnosed before DCE strips it. Demote-to-helper config (1.6+/ext)
correctly OUT OF SCOPE — trailing code genuinely reachable there.

## Classification
enhancement / design-cleanup (diagnostic false-positive) · **low · P3** · SPIR-V target-emit + Diagnostics.

## Not-a-master-bug + key dependency
The mis-firing E55215 exists ONLY on PR #12186's branch (`fix/issue-12185`, OPEN). Nothing
mis-fires top-of-tree → `reproduced` N/A. Refinement to land WITH/AFTER #12186.

## Solution space (memo: triage-12191.md, 3 approaches; recommended = A "capture-early, emit-late")
Snapshot the type-name string during the worklist, defer only the emit to a new step after
`eliminateDeadCode()`, drop entries DCE removed. That deferred-emit step IS the "shared
validation point" the issue asks for. **Trap:** naive "move call after DCE" regresses the message
to `of type ''` (buffer-type name already lowered by then) — exact tradeoff recorded during #12186
review. **Scope correction:** E55210 is NOT a real peer (it's abort-format-must-be-string-literal);
E55215 is the only mis-firing diagnostic.

## Chain state — PARKED for maintainer (2026-07-22)
- GitHub artifact: verified 5-bullet on the issue, **comment 5052588499**.
- **Decision: PARK.** Author = our bot; @pdeayton-nv explicitly deferred it; depends on #12186
  merging first. No slang-fixer dispatch. Hold for pdeayton's call (do now vs after #12186;
  minimal E55215 fix vs generalized validation-point refactor).
- Memo (local trace only, not shared): `/workspace/inbox/a2a-1784762277704-kmw05c/triage-12191.md`.
- **Resume trigger:** #12186 merges, OR pdeayton comments direction. Sibling deferred follow-up
  = #12192 (ConstantBuffer E55215 lacks valid source location).
