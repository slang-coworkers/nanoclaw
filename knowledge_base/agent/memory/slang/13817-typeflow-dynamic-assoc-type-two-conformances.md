---
type: chain
title: "slang#13817 — type-flow: generics over a dynamic associated type with two conformances"
description: External (LDAP) 10-21. Two defects (diamond E33180; generic-witness segfault). Draft PR #13820 fixes the diamond and turns the crash into E33180. Parked on jkwak-work's call (known dyn limitation vs bug).
tags: [ir, typeflow-specialize, dynamic-dispatch, E33180, "13817", "13820", parked]
---

# slang#13817 — type-flow specialization, dynamic associated type, two conformances

- **Reporter:** LDAP (author_association NONE). Filed 2026-10-21 ~11:00Z. No reporter PR on the timeline.
- **Triage:** slang-triager session `9viggv`. Comment 6314992118 (11:39Z), `reproduced` label, Type=Bug, P2/high.
  Reproduced on master 965284957 and on v2026.13.1, so it is not a #12935 regression.
  The defects:
  1. The diamond gives E33180.
  2. `Target<T>:ITarget` passed to `use<T:ITarget>` dereferences a null FuncType in `analyzeCall`.
  3. "Incompatible propagation infos" is not reproduced; it overlaps #13046.
  Triage file: `/workspace/inbox/a2a-1792582710882-m2uxr4/triage-13817.md`.
- **Fix:** slang-fixer session `n7r8qa` (pr-mapping confirmed), branch `fix/issue-13817`.
  DRAFT PR #13820 @c7517306b2, `Refs #13817` (not Fixes), `pr: non-breaking`.
  - Diamond fixed: `_resolveInstRec` (slang-ir-translate.cpp:451) keeps a set-specialized `Specialize` unresolved.
  - The generic witness now reports E33180 instead of segfaulting.
  - R1 APPROVE_WITH_NITS by slang-reviewer; nits applied.
  - Full suite 11021/11024. The 3 failures are fp8 CUDA INVALID_PTX and are unrelated.
  - CI at 17:36Z: 6 success, 52 skipped (draft).
  - Fix Report and explanation: comment 6319395554.
- **Maintainer:** jkwak-work (MEMBER), 17:25Z, cmt 6322223875: "seems like a known limitation also known as `dyn`… T must be a concrete type".
  This is in tension with the diamond fix. I relayed it verbatim to the triager (msg 37, in_reply_to 30).
  The triager and fixer posted one joint reply (cmt 6322485256, 17:38Z; #13820 unchanged). Findings, re-verified on 965284957:
  - Their workaround works only when all three functions take `IBSDF`.
  - Under `#lang slang 2025` the diamond gives E33180 (it matches their rule), but `generic_target` still crashes.
  - In legacy mode the new shape `leaf2(b,3.0)+mid2(b)` also crashes (E99997 `index < getParamCount()`).
  - Options offered: (1) keep #13820; (2) narrow it to both crashes → E33180; (3) close it once the crash fixes have their own PR, plus a docs note.
- **PARKED** on jkwak-work's decision. One-shot re-check task `recheck-slang-13817-e6db` at 2026-10-24 17:30Z.
