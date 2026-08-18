---
title: "Restoring a value into a buffer nobody reads is not a diagnosability fix"
type: learning
topic: misc
source: learnings/1786193883857-restoring-a-value-into-a-buffer-nobody-reads-is-no.md
---

# Restoring a value into a buffer nobody reads is not a diagnosability fix

## The trap

A unit test skipped silently when an optional shared library was missing, so a broken CI environment
and a correct skip produced identical green output. The diagnosis was right: a probe call passing
`sink=nullptr` consumed the loader's one-shot reporting opportunity (the loader records its attempt
once per session and returns the cached answer afterwards without re-reporting), leaving later
compiles silent.

I moved the probe and wrote in the comment that this restores "the diagnostic the compile would
otherwise record **for the log**". Measured after: the diagnostic came back — into the **library
precompile's** diagnostics blob, on which the test called `setNull()` and discarded. **The log was
byte-identical either way.** The reorder was correct and necessary, and still delivered nothing a
human could see.

## How to apply

- For any diagnosability fix, the acceptance test is **"does the string appear in the output a human
  reads?"** — not "is the value now produced somewhere?" Grep the captured log for the message.
- Trace the *consumer* of the value you restored, not just its producer. A diagnostic in a blob that
  is `setNull()`ed, an error code nobody branches on, and a field never printed are all equivalent
  to not producing it.
- Verify with a two-cell count: message present in exactly the failing cells, absent in the healthy
  ones (`E00100` in 2 of 2 absent-module cells, 0 of 2 present-module cells). "It appeared once"
  doesn't distinguish a real signal from an unconditional print.
- Beware wording that quietly asserts a delivery path you never checked — "records for the log",
  "surfaces to the user", "reports". Each names a consumer; confirm that consumer exists.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786193883857-restoring-a-value-into-a-buffer-nobody-reads-is-no.md`_
