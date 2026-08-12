---
title: "[approver/challenger-win] clearing a new SLANG_RELEASE_ASSERT: sibling-arm precedent + failure-direction beats speculative blast-radius"
type: learning
topic: review-approval
source: learnings/1784148942373-approver-challenger-win-clearing-a-new-slang-relea.md
---

# [approver/challenger-win] clearing a new SLANG_RELEASE_ASSERT: sibling-arm precedent + failure-direction beats speculative blast-radius

## Symptom
A PR adds a new `SLANG_RELEASE_ASSERT(x)` on a value derived from a helper that
can return null for some inputs. The bot review flags it as a 🔵 question / 🟡
gap: "this assert could abort on input shapes the old code path tolerated"
(here: slang#12127, `SLANG_RELEASE_ASSERT(storedType)` in the HostVM
`kIROp_Store` arm, where `storedType = tryGetPointedToType(getPtr())` returns
null for ComPtr/NativePtr/raw-pointer types that aren't `IRPointerLikeType`).
The naive challenger reaction is to ABSTAIN (OPEN_GAP) on "plausible crash on
untested shape."

## Root cause of the false-worry
The question conflates "the helper CAN return null for SOME type" with "null
CAN reach THIS assert for THIS op's operands." A store *destination* is not an
arbitrary type — in well-formed SSA it's the result of a pointer-producing op,
and the assert only fires if the emitter is fed a shape it never actually
produces for that target.

## How to catch / clear it (two independent checks, both must hold)
1. **Sibling-arm precedent.** Grep the SAME file for other uses of the same
   helper on the same operand class. In slang#12127, `tryGetPointedToType` was
   ALREADY used UNGUARDED on store-destination pointer types by four sibling
   arms in the very same emitter — `kIROp_Var`, `GetElementPtr`, `FieldAddress`,
   `GetOffsetPtr`. If the helper couldn't resolve those destinations, the far
   more common arms would already null-deref. A new assert over the same type
   population is therefore *strictly safer* than existing shipped behavior, not
   a new risk. (Confirm the flagged types don't appear as bare destination
   *outer* types: ComPtr/NativePtr show up as pointee VALUE types `Ptr<ComPtr<T>>`,
   which resolve fine; the target had no store path for them at all.)
2. **Failure direction.** A `RELEASE_ASSERT` is FAIL-LOUD (immediate,
   non-corrupting compile abort on an out-of-contract shape), which is the exact
   opposite of the silent-miscompile class these fixes usually address. Matches
   the repo's own "fail loudly on out-of-contract input" methodology. A
   fail-loud guard on an unreachable shape is at worst dead defensiveness, never
   a false-safe or a shipped crash.

## Fix / rule
Clear a new `SLANG_RELEASE_ASSERT` as advisory when BOTH hold: (a) an existing
unguarded sibling in the same file already relies on the same helper resolving
the same operand class, and (b) the failure direction is a loud abort, not
silent corruption. Only ABSTAIN if the flagged shape is actually PRODUCED for
the target (show the producing op) — speculative "could return null" without a
reachable producer is over-caution. Contrast slang#11152 (a genuine false-safe)
where the missed op-set WAS reachable via legalization-inserted BitCast/GetOffsetPtr
and the failure direction was silent (`__ldg` re-emitted) — that's the shape
that should ABSTAIN/BLOCK.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784148942373-approver-challenger-win-clearing-a-new-slang-relea.md`_
