---
name: feedback_two_verified_facts_joined_by_an_untested_assumption
description: "A correct measurement plus a correct code reading, joined by an unchecked assumption, reads as fully-verified — and my review of it flagged two other things while making the identical join. Check the JOIN, not the endpoints."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 0c30a936-646a-4a23-8c52-ff5455fdbf0e
---

# Two verified facts joined by an untested assumption read as one verified claim

**2026-08-11, shader-slang/slang#12475.** `slang-triager` produced a triage memo whose recommended fix
was to reuse `_runSlangcWithStdin` to exercise an unreadable-stdin diagnostic. The memo labelled the
coverage claim **"measured, not assumed"** and it had two genuinely verified endpoints:

- **Measurement (correct):** a *closed* stdin gives `read=0 feof=0 ferror=1` ⇒ `ferror` ⇒
  `CannotRead` ⇒ the intended `cannot-read-from-stdin` diagnostic. A read-only `/dev/null` gives
  `feof=1 ferror=0` ⇒ the *empty-input* path instead. Probed with a real C program.
- **Code reading (correct):** `_runSlangcWithStdin` does `Process::create` + `stdinStream->close()`.

**The join was never checked, and it was false.** `Process::create` unconditionally hands the child a
**pipe** on fd 0 (`slang-unix-process.cpp:460`; `slang-win-process.cpp:479`→`:525`), so
`stdinStream->close()` closes the **parent's write end** — the child sees a *valid* fd at **EOF**, which
is the memo's own other row: the empty-input path. The prescribed fix would have failed on Linux on the
first run.

## Why this class is dangerous

Both endpoints survive an audit. Ask "did you measure the descriptor states?" — yes, with a probe. Ask
"did you read the helper?" — yes, with `file:line`. Neither question reaches the edge between them, and
the edge is where the assumption lives. **The "measured, not assumed" label was earned by the endpoints
and inherited by the join.**

Worse: it arrived in a **prescription** (do X) rather than a **hedge** (X might be true). A wrong hedge
costs a re-check; a wrong prescription is built. Same family as
[[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]] — and note the trap sat one
level *below* the author's own probe, i.e. inside the very hazard they were publicly warning about.

## My own miss — this is why the file is mine, not a relay

I reviewed that memo and raised **two** substantive flags (an internal tension about master-visibility,
and a child-spawn-fragility risk). Both were real and both resolved usefully. **Neither was this one** —
the only defect that would have failed on first run. I had both endpoints in front of me, in one
document, and I joined them exactly as the author did. Reviewing hard in two places is not coverage of
the third; a reviewer who accepts a "measured" label re-derives nothing.

## The check

⭐⭐⭐ **When a claim is a chain of ≥2 verified facts, name the JOIN and test it separately.** Write it
as an explicit proposition — *"therefore the child's fd 0 is closed"* — and probe **that**, not its
premises. If the join can't be stated as its own sentence, it hasn't been examined.

⭐⭐ **Reusable noun trap:** on a pipe, **"close stdin" is ambiguous** between the *writer's end*
(⇒ EOF, `feof=1`) and the *reader's fd* (⇒ `ferror=1`), and **the two reach different diagnostics**.
Any spec saying "with stdin closed" is under-specified until it says *which end*. Generalizes to any
paired-endpoint resource where one word names both halves.

⭐⭐ **A "measured / verified / not assumed" label is a claim about coverage, and coverage claims are
the ones to re-derive** — the label tells you where the author stopped looking, not that the conclusion
holds. Treat it as a pointer to the unexamined edge.

Related: [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism verified leg-by-leg that
still didn't explain the instance), [[index-verification-failure-branches]] (sound-evidence branch:
remedy is reading discipline, not instrumentation).
