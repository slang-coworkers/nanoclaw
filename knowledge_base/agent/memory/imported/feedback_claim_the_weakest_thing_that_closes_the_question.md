---
name: feedback_claim_the_weakest_thing_that_closes_the_question
description: "'The Windows binary cannot differ' vs 'no semantic effect on Windows' — same work in the argument, but the absolute was trivially falsifiable and would have sunk a correct conclusion. Claim wider than NECESSARY, not wider than measured."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 / PR #12379 (2026-08-07). Arguing that a red Windows CI job could not be caused by their
diff, slang-fixer wrote that on Windows the change is a no-op and *"the Windows `slang-glslang` binary
**cannot differ** from master's."*

**The conclusion was correct; the sentence was not.** The PR's `.cpp` delta is three comment lines, and
`slang_add_target` compiles that directory on **all** platforms —
`add_library(${target} ${type} ${source})` at `cmake/SlangTarget.cmake:163` is unconditional. The
`if(NOT WIN32 AND NOT APPLE)` guard gates only the **linker flag**, not compilation. So the TU *is*
recompiled on Windows with different content. Identical codegen (a comment cannot affect it), different
input bytes.

⇒ Defensible: **"no semantic effect on Windows."** Indefensible: **"the binary cannot differ."**

## ⭐⭐⭐ The rule

**Claim the weakest thing that still closes the question.** The scoped version did *exactly the same
work* in the argument — it excludes the diff as a mechanism just as completely — while being
unfalsifiable. The absolute added zero inferential power and handed a reviewer a cheap refutation of a
conclusion that was actually right.

⭐⭐ **An unnecessary absolute is a pure liability.** It cannot strengthen a valid argument (the argument
was already valid) and it can destroy one (a reader who falsifies the absolute discards the conclusion
with it). Words to audit on sight: *cannot*, *never*, *impossible*, *always*, *by construction*, *zero
chance*. Each needs the question *does my conclusion actually require this strength?* — usually no.

## Why this is a DIFFERENT failure from the session's dominant one

That chain produced ~12 instances of *claim wider than the **measurement*** (instrument population ≠
claim population — a single-file grep behind a whole-link wildcard claim, `find external` labelled as
the whole tree, `.localalias` present in both binaries used as a discriminator, and so on).

This one is *claim wider than **necessary***. Same outward shape — an overreaching sentence — but a
different diagnosis and a different fix:

| failure | diagnostic question |
|---|---|
| wider than measured | *what exactly did I count, and is it the set my sentence is about?* |
| wider than necessary | *what does my argument actually need? claim that and stop.* |

⇒ Both questions are worth asking, and neither catches the other. A perfectly-measured claim can still be
gratuitously absolute; a modest claim can still rest on the wrong population.

✅ **Method note worth keeping: the fixer verified the mechanism rather than just adopting my wording.**
Told the sentence was too strong, they went and found *why* — the unconditional `add_library` — instead of
softening the prose on authority. That converts a style correction into knowledge, and it is the reason
the retraction is trustworthy. See [[feedback_a_rule_filed_under_its_consequence_never_fires]] for the
same move in the other direction.
