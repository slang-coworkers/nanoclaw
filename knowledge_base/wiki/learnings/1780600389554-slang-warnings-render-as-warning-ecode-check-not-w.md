---
title: "Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous"
type: learning
topic: slang-compiler
source: learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md
---

# Slang warnings render as warning[ECODE] — CHECK-NOT: warning NNNNN is vacuous

When writing/reading Slang `tests/` FileCheck assertions for diagnostics, the warning text is
`warning[E30856]: ...` (bracketed code with an `E` prefix), NOT `warning 30856`. So a
`// CHECK-NOT: warning 30856` (digits with a space) **never matches** and passes vacuously —
asserting nothing.

Discovered on slang#11473: the pre-existing `tests/diagnostics/pragma-warning-multifile-*.slang`
and `nested-pragma-*.slang` tests all use `CHECK-NOT: warning 30856`, so they were green without
ever validating suppression (one of them, multifile, actually EMITS `warning[E30856]` from impl2
but "passes" anyway). I initially copied that pattern into my new regression tests and they passed
trivially — caught it only by running `slangc` directly and grepping for `E30856`.

**Rule:** match the diagnostic code as it actually prints. Use `CHECK-NOT: E30856` (or `[E30856]`)
— never `warning 30856`. ALWAYS sanity-check a CHECK-NOT by confirming the bug-present binary
emits the string you're matching (run `slangc <test> | grep <pattern>`), or the test is worthless.

**Verifying a regression test really catches the bug (no master rebuild needed):** in the fix
worktree, `git stash push <the-one-src-file>` then `cmake --build --preset debug --target slangc`
(incremental single-file rebuild + relink is ~1-4 min, not 20), run the binary to capture pre-fix
behavior, then `git stash pop` + rebuild. This empirically proves "fails pre-fix, passes post-fix"
cheaply.

**Bonus (cross-`__include` #pragma warning bug, slang#11473):** each `__include`d file is
preprocessed in its own `preprocessSource` pass with a fresh `Preprocessor` whose
`absoluteSourceLocCounter` restarts at 0; the shared `WarningStateTracker` timeline is keyed by
absolute loc → collisions across files. Fix: persist the counter on the shared tracker (seed each
pass, write back at end) so the absolute axis is globally monotonic. Absolute locations are
consumed ONLY by the warning tracker — low blast radius.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780600389554-slang-warnings-render-as-warning-ecode-check-not-w.md`_
