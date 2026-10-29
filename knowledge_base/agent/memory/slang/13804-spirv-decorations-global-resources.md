---
type: chain
title: slang#13804 — no way to put SPIR-V decorations on global resource OpVariables
description: Feature request (Bonkt), triaged 10-21, P2. Side bug D (spirv_asm `&` crash) fixed in bot draft PR #13809. The feature waits on tangent-vector to pick an approach. Parked in the register 10-28 after the one-shot re-check t-26dd74 found no change. No re-check is armed.
tags: [spirv, decorations, spirv_asm, parked]
---

# slang#13804 — SPIR-V decorations on global resources

**Ask.** `vk::ext_decorate` (or similar) on global resource `OpVariable`s. Triage comment
[6310268779](https://github.com/shader-slang/slang/issues/13804#issuecomment-6310268779), 10-21 07:11Z,
labels `reproduced` + `SPIR-V`. Approaches offered to maintainers: **A** `vk::ext_decorate` (recommended),
**B** `&global` in `spirv_asm`, or both. Related: #7019.

**Side bug D: PR #13809** (draft, "Addresses part of #13804", so it does not close the issue). An invalid
`&` operand in `spirv_asm` segfaulted; now it gives error E29103 and lowering uses a poison pointer.
slang-reviewer R1 returned APPROVE_WITH_NITS and the nits were applied. The label went from breaking to
`pr: non-breaking`, following #12506.

**Verified on GitHub 2026-10-28:**
- issue: OPEN, assignee tangent-vector (set 10-21 ~17:17Z), milestone Q4 2026 (Fall). Our comment is still
  the only one. Nobody has given design direction.
- #13809: draft, head `771cf1a20`, assignee and review request kaizhangNV, 0 reviews, last update 10-21 11:03Z.

**Disposition: PARKED 10-28.** The one-shot re-check `t-26dd74` fired with no change. No re-arm: the issue
now has a human owner and a milestone, and webhooks deliver any comment. This entry is the
parked-chain register record.

**Decision owners:**
- tangent-vector: approach A, B or both.
- kaizhangNV: review #13809 and mark it ready.

**Follow-up issue: PARKED-UNANSWERED, do not re-ask.** It was asked of the operator 10-21. When IR
generation fails, `Linkage::loadParsedModule` still caches the module, and a second load hits an assert in
slang-ir-link. Not filed.

**Resume on:**
- a human comment on #13804 or #13809, through the webhook to slang-triager / slang-fixer on
  `gh-issue-shader-slang/slang-13804`;
- #13809 marked ready: full CI runs then;
- an operator ask.
