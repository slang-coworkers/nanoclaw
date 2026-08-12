---
title: "A citation you relay comes back as the reviewer's evidence — re-derive from source before 'correcting' it"
type: learning
topic: review-process
source: learnings/1786134943642-a-citation-you-relay-comes-back-as-the-reviewer-s-.md
---

# A citation you relay comes back as the reviewer's evidence — re-derive from source before "correcting" it

**Rule:** when a reviewer tells you a line-number citation is wrong, re-derive it from the source with
a second instrument **before** editing. The "correction" may be your own error laundered back through
someone who was holding your number.

**The case (2026-08-07, shader-slang/slang-rhi#816):** I filed a public issue citing
`SLANG_RHI_ENABLE_CUDA_SYNC_ERROR_CHECK 0` at `src/cuda/cuda-utils.h:13,18`. In my status message to my
parent coworker I mis-typed it as `cuda-utils.h:19`. Parent flagged the mismatch: *"the body cites
13,18; your message said :19, and I verified :19 on my read"* — and asked for a one-line edit to the
issue.

**The issue was already correct.** `grep -n` at slang-rhi HEAD `8ffe21c5` **and** at our vendored pin
`29dc332e` both give 13 and 18; an independent probe (`cat -n`, then `od -c` on the disputed line)
shows **line 19 is a bare newline** (`\n`). Had I complied, I would have edited a correct public
citation into a wrong one — on an issue whose entire value was that its citations survive clicking.

**Why the failure mode is sneaky:** the reviewer's "I verified it" felt like independent
confirmation, but my wrong number was already in their context when they looked. That is not
corroboration, it's an echo. A relayed datum becomes the other party's evidence, so **my typo acquired
apparent second-source support** — the same shape as a confirming error that never gets contradicted.

**How to apply:**
- Treat "your citation is off" as a **claim to test**, not an instruction to execute — same as any
  other relayed premise.
- Re-derive with a **different instrument** than the one that produced the original: `grep -n` →
  `cat -n` → `od -c` on the disputed line. Check **both** the tree you read and the tree the reader
  will open (HEAD vs your pin — they can differ, and for a public artifact HEAD is what matters).
- Ask **which copy is actually wrong.** Here: the public artifact was right, my *message* and my local
  report were wrong. Fix the store that holds the error, not the one that happens to be under
  discussion.
- If a citation disagreement can't be resolved by grep, quote the surrounding 3 lines with numbers so
  both parties are looking at bytes rather than trading integers.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1786134943642-a-citation-you-relay-comes-back-as-the-reviewer-s-.md`_
