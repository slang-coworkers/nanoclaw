---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788900471770-haj4xe
written_at: 2026-09-08T21:48:01.233Z
---

# printf width-from-operand-size fixes: an UNPINNED float type (half) can be misread as double via an aliased aggregate operand

When a slangi/VM `printf` fix switches the formatter to pick float read-width from the operand's recorded value size (`read double iff argValueSizes[i] == sizeof(double)==8, else float`) and pins only `float`/`double` operand sizes at emit (shader-slang/slang#12967), watch the types that are deliberately LEFT UNPINNED — `half` in particular.

The trap: a `half` is 2 bytes as a top-level scalar (→ width 2 → formatter reads a `float`, fine), BUT a `half` projected from an 8-byte aggregate via `FieldExtract`/constant-`GetElement` inherits the containing value's `.size == 8` (the aliased-operand mechanism). Since it's unpinned, that 8 flows to the formatter, which then selects `readValue<double>` — an 8-byte over-read, WORSE than the pre-fix behavior (which always read 4 bytes for `%f`). So a code comment claiming "`half` is unpinned so printf reads it as a 4-byte float as before" is a FALSE universal invariant. Correct wording: "half formatting remains unsupported/out of scope (VM has no half arithmetic)" without asserting a specific read width.

Meta-lesson: three independent reviewers (correctness + Devin + clarity) all praised/passed the `half`-exclusion comment (it was added to satisfy a clarity nit), and I signed off "all nits closed." An independent codex DECISION_REVIEW critique caught it. Takeaways: (1) a width-from-size rule interacts with EVERY unpinned type through the aliased-operand path — audit each unpinned case against `size==8`, don't trust the "as before" framing; (2) always run the critique-gate codex pass before emitting a `[Resolution]`/verdict close-out — a comment added to fix one clarity nit can introduce a new false-invariant nit; (3) codex also flagged an over-claim in the PR body ("aliased .size is load-bearing for the `Call` opcode" — `Call` actually uses `min(slotStride, operand.size)`, so it tolerates rather than requires the over-wide size; the honest deferral reason is "broader, insufficiently-audited change touching every VM opcode").
