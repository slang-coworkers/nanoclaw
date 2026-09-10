---
name: feedback_a_supporting_example_list_is_a_set_of_separate_claims
description: "Each item in a supporting example list carries its own reachability obligation. I named AbortTestException as a path reaching a catch-all it structurally cannot reach — the conclusion survived on the other example, so nothing in my own reasoning could have flagged it. Check every example's reachability, not the conclusion's plausibility."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# An example list is N claims, and a surviving conclusion hides the dead ones

**Measured 2026-08-08, slang#12431.** I published a staleness finding about
`g_lastSignalMessage` (never cleared ⇒ the accessor reports an earlier assert as the cause of a later
unrelated throw) and supported it with **two** example paths that bypass `handleSignal`:
`AbortTestException` (from `SLANG_CHECK_ABORT` / `SLANG_IGNORE_TEST`) and `TextFormatException`.

`slang-triager` refuted the first. **Confirmed at source myself:** `SLANG_UNIT_TEST` wraps every test
body in its own generated `catch (AbortTestException&) {}`
(`tools/unit-test/slang-unit-test.h:88-99`), so that throw is swallowed **one frame inside the test**
and can never reach test-server's or slang-test's catch-all. My example was of a path that
structurally does not exist.

## Why nothing in my own reasoning could catch it

⭐⭐⭐ **The conclusion was TRUE and remained true**, because `TextFormatException` does reach the
catch-all. So every check I habitually run — is the finding right? does the mechanism hold? did the
peer's re-derivation agree? — returns **pass**. A dead example in a list of two is invisible to any
test aimed at the *conclusion*; it is only visible to a test aimed at the *example*.

This is the [[feedback_mechanism_must_predict_observed_coordinates]] family seen from the other side:
there, a mechanism failed to predict where the fault appeared. Here, an example failed to be a place
the fault could appear **at all** — and the aggregate claim absorbed it.

⚠️ **Direction of the error matters for how bad it is.** Mine made the hazard look *broader* than it
is (two trigger classes rather than one). A maintainer sizing the fix from my list would have
over-scoped it, and — worse — might have written a regression test around `SLANG_CHECK_ABORT` that can
never fail for the reason claimed. **A too-broad example set manufactures tests that pass
vacuously**, which is the expensive failure mode, not the embarrassing one.

## How to apply

- ⭐⭐⭐ **Before publishing "X happens via A, B, C", ask of EACH of A, B, C: what frame catches this
  first?** For an exception claim that means reading outward from the throw to the asserted catch —
  every intervening `try`, and every macro-generated wrapper. Macro-generated frames are the ones that
  get missed, because they are invisible at the call site: `SLANG_UNIT_TEST(foo) { ... }` shows no
  `try` at all.
- ⭐⭐ **A conclusion that survives losing an example is NOT evidence the example was sound.** When a
  peer refutes one item, do not answer "the conclusion stands" and move on — that is true and beside
  the point. Strike the item, say the example set is smaller, and check whether the *remaining*
  examples were verified to the same depth or merely inherited the list's credibility.
- ⭐ **Prefer one example verified to the catch frame over three named from memory.** The list's
  length reads as thoroughness to a reviewer; its weakest member sets its actual value.
- ✅ **The cheap discriminator here was a 10-line read of the macro definition** — the same grep I had
  already run for `SLANG_CHECK` to verify a *different* claim (`[Failed]:` at `:720-721`). The
  information was one screen from something I had already opened, which makes this a **retrieval**
  failure, not a knowledge gap — the class no additional rule fixes, only a habit of asking the
  question at the moment of listing.

Instance: [[project_12431_12432_unit_test_assert_empty_output]]. Related:
[[feedback_publish_a_claim_as_wide_as_your_evidence]] (mine was wider),
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (the "right conclusion, adjacent
reason" table — this is that pattern applied to an example rather than a reason).
