---
name: feedback_state_what_the_residual_is_not_just_its_size
description: "'26 std:: of 31 exports' was arithmetically CORRECT and still misled — it implied 5 intended entry points; there are 4. A recount cannot catch a wrong residual. Enumerate B−A, don't just size it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 / PR #12379 (2026-08-06). To argue the libstdc++ re-export leak wasn't glslang-specific, I
relayed and re-published a figure three times: **`libslang-llvm.so` — 26 `std::` of 31 exports.**

**The number was right. The shape it implied was wrong.** A reviewer reconciled it: of those 31
exports only **4** are intended entry points (`createLLVMBuilder_V3`,
`createLLVMDownstreamCompiler_V4`, `createLLVMFileCheck_V1`,
`getLLVMTargetBuiltinTypeLayoutInfo_V2`). The 5th non-`std::` export is
**`llvm::Use::set(llvm::Value*)`** — a genuine C++ leak, just not a `std::` one. True shape:
**4 intended / 27 leaked.**

## Why this one is different from a miscount

⭐⭐⭐ **Nothing was counted wrong, so no recount, total-check, or control could have caught it.**
`26` and `31` were both accurate. The error lived entirely in what the reader infers about the
**residual**: `31 − 26 = 5` reads as *five intended exports*, and I never checked whether the residual
was homogeneous. Every verification habit I have targets the measured quantity; this error was in the
unmeasured complement.

⇒ **When publishing `A of B`, enumerate what `B − A` IS — not just its size.** The reader's conclusion
lands on the complement, so the complement is the claim. Here that means listing the 5 non-`std::`
exports, at which point `llvm::Use::set` is immediately visible as not-an-entry-point.

⇒ Especially load-bearing for **leak-vs-interface** figures, where the whole point is "this many
shouldn't be there": the intended set is the thing being asserted, and it's the thing sitting in the
unexamined residual.

## Instrument note from the same correction

Confirming "`llvm::Use::set` has no in-tree reference" needed the instrument fixed first:
`grep -rn "Use::set" source/` returns **1** hit — Slang's own `IRUse::set` at `slang-ir.cpp:180`, a
**substring** match, not the LLVM symbol. Positive control (`createLLVMBuilder` → 2 hits) confirmed the
grep reached the tree. ⇒ **A short symbol name grepped without a boundary will collide with unrelated
code that happens to end the same way; a non-zero result is not a hit on your target.** Same family as
[[feedback_a_wildcard_export_claim_needs_the_link_not_the_file]] — instrument population ≠ claim
population.

## Chain context

This was the **8th** instance in one session of a single generator: *an instrument whose filter or
population differs from the claim it is used to support*. Prior instances included a loose grep hitting
a dependency's instantiation, `.localalias` present in both binaries being used as a discriminator,
`ninja -t commands` including transitive deps, a `GLOBAL DEFAULT` filter over `WEAK DEFAULT` symbols,
a two-dot `git diff` against a moved base reporting 9 files / 461 deletions on a 3-file change, and my
own single-file grep behind a whole-link wildcard claim. **This instance is the one that proves the
generator isn't about sloppiness — a correct measurement can still carry a false claim.**
