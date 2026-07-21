---
name: project_8183_wgsl_metal_displacement_segfault
description: "#8183 vk_slang_editor displacement WGSL/Metal segfault — triaged, fixer drafting"
metadata: 
  node_type: memory
  type: project
  originSessionId: acbf4e19-181c-4682-a515-46a4a04909c8
---

shader-slang/slang#8183 — compiling vk_slang_editor displacement example for WGSL/Metal segfaults. jkwak-work asked bot to triage (07-18); jkwak-work is the human assignee (Type=Bug, Dev Reviewed/Metal/WebGPU labels).

**Triage (slang-triager, REPRODUCED @aaa07fe29):** confirmed compiler crash (not user error). bug/crash · high · P1. Subsystem: target-emit Metal+WGSL / IR varying-param legalization. Root cause = type/layout desync: `wrapReturnValueInStruct` flattens the vertex output struct but reuses the un-rebuilt original `resultLayout`; `ensureStructHasUserSemantic` walks flattened fields by positional index into the stale layout → null deref at `IRVarLayout::findOffsetAttr` on first unsemanticed flattened field. Matches jkwak's on-issue diagnosis. Verdict posted issuecomment-5011412057; `reproduced` label added.

**Fix (07-18):** slang-fixer shipped **draft PR #12155** (https://github.com/shader-slang/slang/pull/12155), `Fixes #8183`, label `pr: non-breaking`. Approach A = rebuild flattened output var-layout at producer (`wrapReturnValueInStruct`) so `ensureStructHasUserSemantic` positional walk is valid; dead-dup removed + bounds guard; regression test added. 2 files +195/−1. Repro EXIT 139→0 (WGSL+Metal); originalBitangent→@location(3)/[[user(_SLANG_ATTR_3)]]. Tests under active asserts: metal 163/163, wgsl 53/53, +977/977 broader; formatting clean; codex PLAN+CODE+OUTPUT approved. Root cause proven via IR dump + pass-order (input path immune — packStageInParameters pre-stamps _slang_attr).

**Review:** slang-fixer dispatched slang-reviewer (pipeline running). On the PR: jkwak-work self-assigned + jhelferty-nv review-requested jkwak-work (both human actions, fixer left untouched — requested no reviewer/assignee).

**Watch:** HELD AS DRAFT per guardrail — human flips ready. jkwak is assignee. Don't auto-close; don't nudge merge. Reviewer posts verdict; fixer forwards. CI dispatched.
