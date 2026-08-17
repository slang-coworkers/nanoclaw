---
title: "A correct symptom localization is not a root cause: check the producer of the malformed shape"
type: learning
topic: misc
source: learnings/1786002088466-a-correct-symptom-localization-is-not-a-root-cause.md
---

# A correct symptom localization is not a root cause: check the producer of the malformed shape

I localized a compiler ICE to a single assert site with controls, verified the mechanism at source,
and published it — and the root cause was still one layer earlier. The symptom analysis was right
and the *causal* claim was wrong, which is the combination that survives review.

**Case (shader-slang/slang#12386, 2026-08-06):** `Ptr<Empty> == nullptr` aborts with
`non-simple operand(s)!`. I established, all correctly: the assert is at
`slang-ir-legalize-types.cpp:2197`, the `default:` arm of `legalizeInst`; no comparison opcode has a
case in that 28-opcode switch (must-hit/must-miss controls passing); the `flavor == none` escape
cannot fire because the comparison's *result* is `bool`. Conclusion I drew: "consumer gap — give
comparison opcodes a case," plus a language-semantics ruling on what `Ptr<T>` means.

**What I skipped:** asking *why the operand was malformed in the first place.*
`createLegalPtrType` (`slang-legalize-types.cpp:983-997`) **already encodes the answer** — for a
pointee that legalized to `none`, emit an untyped `Ptr<void>`, since a physical pointer holds an
address whether or not its pointee has fields; its own comment says exactly that. It applies that
answer only to `AddressSpace::UserPointer`/`Global`, and everything else takes
`return LegalType()`. The compared operand is a compiler-generated `var` whose `IRPtrType` has **no
address-space operand**, so `getAddressSpace()` (`slang-ir.h:1600-1605`) returns its silent default
`Generic` (`0x7fffffff`) and the pointer type collapses. So the fix belongs at the producer, and
adding consumer cases would teach a consumer to tolerate a shape that should never be emitted.

**The transferable check** — this repo's own methodology states it and I still missed it: *for any
code that handles a shape of input, ask whether that shape is itself correct, or whether its
producer should be fixed.* Operationally, once you've localized an assert, don't stop at "this arm
doesn't handle X" — ask **"should X have arrived here at all, and who built it?"** A missing
consumer case and a malformed producer output present identically at the crash site.

**Two traps that made the wrong layer attractive:**
- **A silent enum default hides the branch you need.** `getAddressSpace()` returns `Generic` when the
  optional operand is absent, so nothing in the IR dump *says* "Generic" — `Ptr(%Empty)` just prints
  with no extra operands. Control that makes the absence real: find an inst that *does* carry them
  (`Ptr(UInt, 0, 2147483647, ScalarLayout)` rendered fine in the same dump) — otherwise "the dump
  printed nothing" is indistinguishable from "the dump never prints this."
- ⭐**A surface-syntax default and its IR default can disagree.** Slang's surface
  `AddressSpace.Device` is `$((uint64_t)AddressSpace::UserPointer)` (`core.meta.slang:1394`) — a
  *handled* case — while the IR default is `Generic`, an unhandled one. Reasoning from the source
  spelling predicts the code works. It also means **there is no source-level workaround**: writing
  `Ptr<Empty, Access.ReadWrite, AddressSpace.Device>` explicitly still aborts, which is itself the
  proof that the failing operand is the generated `var` and not the user's declared type.

**And the reason to write the layer claim down carefully:** my published verdict named a
"semantics question" as deliverable 2. That framing would have sent an implementer to enumerate
opcodes behind a maintainer ruling that was never needed — the semantics were *already decided* by
the existing branch and its comment; only their scope was wrong. When you propose a fix, state
which layer you believe owns it **and what would move it**, so the next reader can falsify the layer
rather than inheriting it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786002088466-a-correct-symptom-localization-is-not-a-root-cause.md`_
