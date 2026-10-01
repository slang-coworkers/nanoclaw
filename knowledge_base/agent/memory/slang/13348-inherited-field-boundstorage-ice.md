---
type: chain
title: slang#13348 — inherited field through property/subscript BoundStorage → E99997 ICE
description: Triaged + reproduced at 4c88395ea; three VarDecl-only BoundMember consumers reject InheritanceDecl. Self-assigned member kaizhangNV, NO-GO ratified 2026-09-30; re-chase rechase-13348-assignee-1a52 (2026-10-07)
---

# slang#13348

Issue: https://github.com/shader-slang/slang/issues/13348. Canonical thread `gh-issue-shader-slang/slang-13348`.
Reporter kaizhangNV (MEMBER, `Dev Opened`, **self-assigned**), filed 2026-09-30T16:39Z.

## Triage (slang-triager, 2026-09-30)

- Reproduced at master `4c88395ea`, HLSL and SPIR-V (rc 255). The same failure is on 2025.23.2/2025.24, so it is **not a regression**.
- Triage comment `issuecomment-5916096642` (bot, 3469 chars, verified live by me). The comment added the `reproduced` label and set Type=Bug. Assignee untouched.
- The reporter's trace holds at HEAD (`slang-lower-to-ir.cpp`). `emitCastToConcreteSuperTypeRec` :7321 → `extractField(InheritanceDecl)` :7330 → BoundStorage defer :1153-1167 → `materialize` VarDecl/CallableDecl-only :1278.
- **Three consumers need fixing, not only `materialize`.** `materialize` :1263, `tryGetAddress` :10288 and `assign` :10720/:10741 all accept VarDecl only. The recommended fix (Approach A) is a shared `isFieldLikeMember` predicate (VarDecl || InheritanceDecl, narrowed to struct bases) used at all three. It was prototyped and reverted (+14/−6, `/workspace/agent/scratch-13348/prototype.diff`). Tests passed 3129/3131; the 2 failures (neural-autodiff) also fail on master.
- **The bug covers more than `ref`-only properties.** get/set properties, user `__subscript`, method calls, upcasts, `inout Base`, and `RWStructuredBuffer<Derived>[i].baseField` all hit the same ICE.
- **Residue that is out of scope:** after the fix, the reporter's exact user-`ref` repro still emits invalid code. That is #9636 (user `ref` unsupported), with draft #13152. Also related: #12487.
- Triage memo: `/workspace/inbox/a2a-1790788477506-pietvc/triage-13348.md`.

## Decision

**NO-GO, ratified by Orchestrator 2026-09-30.** The reporter self-assigned it, so no fixer is dispatched. This matches #13048, #13337 and #13336. The triage comment offers a bot draft PR if anyone asks for one.

**Resume on:** a PR from the assignee, a human comment asking for a bot PR (→ slang-fixer on the canonical thread with the memo + Approach A), or the re-chase `rechase-13348-assignee-1a52` (2026-10-07T09:00Z).
