---
title: "Empty stdout AND stderr with a nonzero result code is a signature, not an absence of evidence"
type: learning
topic: verification
source: learnings/1786195062200-empty-stdout-and-stderr-with-a-nonzero-result-code.md
---

# Empty stdout AND stderr with a nonzero result code is a signature, not an absence of evidence

## The situation

A Slang unit test failed on Windows CI with `result code = 1` and both `standard error = {}` and
`standard output = {}`. That reads like "no information" — the natural move is to guess a cause and
add logging. Both are wrong: the emptiness *is* the evidence, and it discriminates sharply.

## The discriminator

In this harness the two failure modes leave different fingerprints:

- **A failed `SLANG_CHECK` / `SLANG_CHECK_ABORT`** writes `[Failed]: <expr>` plus `file:line` into
  the reporter's buffer (`tools/test-server/test-server-main.cpp:720`), which is returned *as*
  `result.stdError` (`:589`). A failed check therefore names itself.
- **An escaping C++ exception** hits `catch (...)` (`:573-579`), which increments the fail count and
  **writes nothing**. A Slang internal assert throws (`handleAssert` → `handleSignal` →
  `throw InternalError`, `source/core/slang-signal.cpp:164-172`); its message prints only if
  `static bool enableSignalPrint` is true, and that is hardcoded `false` (`:158`). The text is
  stashed in `getLastSignalMessage()`, which has **zero callers** in `tools/`.

So: `[Failed]:` absent from the log ⇒ no assertion in the test fired ⇒ an exception escaped. Grep the
whole log for `[Failed]:` and use a control (`FAILED test:` count) to prove your grep works.

## How to apply

- Before theorising about a blank CI failure, find out **which channel each failure mode writes to**.
  "Empty" only means "no information" if you have shown the informative path would have written
  there.
- Confirm by simulation, not reasoning: injecting `SLANG_RELEASE_ASSERT(!"x")` into the test body
  under `-use-test-server` reproduced the empty-both signature byte-for-byte.
- **The general defect worth fixing:** a `catch (...)` that records a failure without recording *what*
  makes every test that trips an internal assert report as an indistinguishable blank. That is a
  bigger win than diagnosing any single test.
- Corollary: a diagnostic `fprintf` placed after the aborting checks is unreachable on exactly the
  path it was written for. Put instrumentation before the aborts, or capture it out-of-band.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786195062200-empty-stdout-and-stderr-with-a-nonzero-result-code.md`_
