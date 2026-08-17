---
title: "CORRECTION + scope fix: `CHECK-NOT` is a FileCheck directive — it works under `filecheck=`, and is absent from `diag=`'s grammar entirely"
type: learning
topic: verification
source: learnings/1786068919164-correction-scope-fix-check-not-is-a-filecheck-dire.md
---

# CORRECTION + scope fix: `CHECK-NOT` is a FileCheck directive — it works under `filecheck=`, and is absent from `diag=`'s grammar entirely

**Scope correction to my earlier note titled "slang-test `diag=` diagnostic tests SILENTLY IGNORE `CHECK-NOT`".** That title is too broad and, applied literally, would make a future reader delete legitimate `CHECK-NOT` lines. `append_learning` is immutable, so this is the amendment — read them together.

**The repo has two matchers, and only one lacks the directive:**

| directive | matcher | `CHECK-NOT` |
|---|---|---|
| `filecheck=` / `filecheck-buffer=` | real LLVM FileCheck | ✅ works |
| `diag=` | slang-test's own annotation parser | ⛔ not in the grammar at all |

Measured: **18** test files using `filecheck` also use `CHECK-NOT` legitimately. Deleting those would be a regression.

**Corroboration stronger than my single flip test:** `docs/diagnostics.md` (4,442 B) contains **zero** occurrences of `CHECK-NOT`, against a control of **9** occurrences of `CHECK` — so the grep can match and the absence is real. The doc enumerates the entire `diag=` grammar: message text, severity (`warning`/`error`), error code (`E20101`), caret columns, and two modes (default exhaustive, plus `non-exhaustive` which ignores extras). There is **no negative form in the grammar**, so this is structural, not a bug to work around.

**State the rule positively:** under `diag=`, **exhaustive mode *is* the negative assertion.** Every emitted diagnostic must carry an annotation, so an unexpected one (e.g. an `E40020` unroll failure you're trying to exclude) fails the test by construction. Verify that protection positively — delete one expected `//CHECK:` and confirm the test goes RED. Don't add a `CHECK-NOT`; it will be inert.

If you genuinely need an explicit negative assertion, use a `filecheck=` test — but note `CHECK-NOT` is **region-scoped** there: followed by a positive directive in the same prefix it covers only up to that match, so give negatives their own prefix.

**Meta-lesson, which is the durable part:** this was the *fifth* distinct mechanism by which a `CHECK-NOT` is inert in this repo (others: unbounded/EOF-bounded; stream-ordering — `slang-test-main.cpp:1882-1890` appends stderr before stdout so a `-NOT` anchored after a positive is already past the text; passes-when-flipped; vacuous-by-construction in `tests/cuda/optix-exported-device-function.slang`). Five mechanisms, one remedy: **make every negative assertion fail on purpose once.** A trap list is always one mechanism behind — I hit #5 minutes after writing up #1.

Also: a correction is itself an assertion. I verified both of these claims (`grep -c` with a control, and the 18-file count) rather than relaying them.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786068919164-correction-scope-fix-check-not-is-a-filecheck-dire.md`_
