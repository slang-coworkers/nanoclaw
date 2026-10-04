---
type: chain
title: slang#13409 — Metal groupshared load forwarded/moved across barrier; sibling #13412
description: canInstHaveSideEffectAtAddress (slang-ir-util.cpp:1442) exempts in-function roots from "call may write"; fix = strict A + Metal emitter guard; pointer-root sibling #13412 held
---

# slang#13409 (human-filed, girivs82, 2026-10-02) + sibling #13412

**Root (triager, I checked the source at master `00febe288c`):** in the `kIROp_Call` arm of `canInstHaveSideEffectAtAddress`,
the "callee may write anything" check is skipped whenever `isChildInstOf(getRootAddr(addr), func)`.
On Metal and CPU, `groupshared` becomes a function-local `var` with `AddressSpace::GroupShared`
(`introduceExplicitGlobalContext`). Because of that exemption, barriers and `[noinline]` calls are treated
as unable to touch it, so `tryRemoveRedundantLoad`, `processLoadUse` (simplifyForEmit) and DSE
miscompile the code. This has been broken since at least 2025.6.1.

## Decisions (mine)
- 10-02 ~19:05Z: GO on Approach A, through the triager. "No emitter change."
- 10-02 23:10Z: **scope widened to (b)**. One draft PR, two commits: (1) strict A, where any call, even a
  `[noSideEffect]` one, may read or write a GroupShared root; (2) a C-like emitter guard in `emitVar`+`emitStore`
  so a store is never folded into a `threadgroup` declaration, which MSL rejects. Why: A keeps the var alive in
  mesh/object shaders, and the fold would then turn a wrong value into a compile error.
- The fold already happens on master. **I verified it at `6ba151dcfc`:** `s = tid.x; barrier; InterlockedAdd(s,1,old);` with
  no other globals emits `threadgroup uint s_0 = tid_0.x;`. Adding a buffer global, or dropping the atomic, makes it
  disappear: my 4 shapes plus a buffer-carrying atomic shape all came out bare. ⇒ A repro claim that depends on the
  shape needs that exact shape run before anyone disputes it.
- MSL evidence: the spec has no sentence stating the rule. Cite SPIRV-Cross `spirv_msl.cpp:3868` instead, and
  have the fixer add a `-target metallib` test.

## PR #13421 (draft, opened 10-03, head `6ad57af497`, 2 commits as decided)
Both commits are authored by **User `286953280`** (the unsigned-CLA identity), so `license/cla` is pending. Not a merge block on slang.
The triager asked for a re-author force-push. **I did not authorize it** (history rewrite, not durably
authorized), and on 10-03 05:35Z bundled it with the operator's still-unanswered CLA decision from 10-02.
Signing the CLA (a) makes the push unnecessary. Re-chase `rechase-cla-bot-identity-4012`. New commits on the branch
use the App identity.

## Sibling #13412 (bot-filed by triager 10-02 19:20Z, `reproduced`)
Pointer roots (loaded/computed/param) get the same exemption, on **all targets incl. direct SPIR-V**.
Finding 3 (a `RWStructuredBufferGetElementPtr` root, a device-buffer load moved across barriers, source-emit only)
was posted as comment 5963139346; I verified it: bot author, 3207 chars. **No fixer yet**: GO waits for a reviewer
verdict on #13409's draft. The fix is the corrected B: only an unpassed local `var` is immune, and inout params
need an explicit decision. Naive B breaks copy-in/copy-out after `undoParameterCopy`.

## Sessions / tasks
Fixer `sess-1790967825882-vnvecr`, triager `sess-1790963826393-0y71gs`, both on `gh-issue-shader-slang/slang-13409`.
Re-chase `rechase-13409-sibling-7aad` (2026-10-04 19:00Z) holds the full state.
