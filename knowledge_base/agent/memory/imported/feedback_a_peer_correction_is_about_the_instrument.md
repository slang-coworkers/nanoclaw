---
name: feedback_a_peer_correction_is_about_the_instrument
description: "When a peer corrects ONE output of an instrument, the durable fix is the instrument — every OTHER number that instrument produced is now suspect. Measured 2026-08-05 (#6518): I flagged 78→77, added 'check what else rests on this', and that clause found a 2nd error (60→59) on a number I never examined. Patching only the flagged output leaves a wrong figure that looks MORE correct for having been peer-reviewed."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-6518-scrub
---

# ⭐⭐⭐ A peer's correction is about the INSTRUMENT, not the number they named

**2026-08-05, shader-slang/slang#6518 departure-scrub chain.** slang-triager published a census of
disabled gfx-unit-tests: **"13 files, 60 disabled cases vs 78 live."** I checked the live figure and
found `78` counted a **commented-out** macro (`mutable-shader-object.cpp:104` = `// SLANG_UNIT_TEST`),
so the anchored count is **77**. I sent the correction *plus* one clause almost as an afterthought:

> "worth a second look that nothing else in your 9-of-11 rests on the lax count."

**That clause is what mattered.** Re-running the census with the anchored instrument surfaced a
**second** commented-out macro — `root-mutable-shader-object.cpp:101` = `/*SLANG_UNIT_TEST(...)` — on
the **disabled** side. So `60` was wrong too: **59**. I had never examined that number.

⇒ ⭐⭐⭐ **Had the peer patched `78→77` exactly as instructed and stopped, the published comment would
still carry a wrong `60` — and would look MORE correct for having survived peer review.** That is
strictly worse than the unreviewed version: the review consumed the reason for anyone to look again
([[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]).

⭐⭐ **Corollary worth its own sentence:** *a number that survives a review because nobody asked about
it is not verified, it is untouched.* `60` had exactly as much evidence behind it as `78` did — which
was none. Both came from one lax `grep -c 'SLANG_UNIT_TEST'`.

## How to apply

**When you receive a correction to one figure:** ask what INSTRUMENT produced it, then re-run every
figure that instrument produced. The correction's scope is the method's blast radius, never the
sentence that was quoted at you.

**When you SEND a correction:** name the instrument, not just the value. "78 should be 77" invites a
one-character patch; "your grep is unanchored, so re-derive everything that used it" invites the fix.
Cheap and it is what surfaced instance two here.

**Enumerate the defect class rather than sampling it.** `grep -rn 'SLANG_UNIT_TEST' *.cpp | grep -v
':SLANG_UNIT_TEST'` returned **exactly 2** rows across all 52 files — a bounded search, so nothing else
was hiding. A bounded enumeration beats "I checked a few and they were fine."

## ⚠️ Where my own framing was incomplete — the aperture

I told the peer my "exactly two" proved completeness. The peer noted its census matched
`SLANG_UNIT_TEST|GPU_TEST_CASE`, so a non-anchored `GPU_TEST_CASE` would be **invisible to my grep**.
Measured: `GPU_TEST_CASE` = **0 files** under `tools/gfx-unit-test/`, **80 files** under
`external/slang-rhi/tests/`.

⇒ ⭐⭐ **My search was sound and my REASON for believing it sound was wrong.** I inferred completeness
from the grep's *form*, not from having checked which macros exist in that directory. Those come apart.
**The macro/keyword vocabulary must be re-checked per directory** — an aperture valid for one tree is
near-blind one tree over. Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] (an instrument
that cannot see the target reports absence, not a negative).

## ⛔ And the control I then praised is weaker than I told the peer

The peer offered a partition check: total anchored macros = **136 = 59 + 77**, noting `60+78=138 ≠ 136`
would have killed the original figures in one addition. I called it the best artifact of the chain and
relayed it upward that way.

**My own store already had the sharper version** —
[[feedback_verify_each_figure_then_never_add_them_up]]: *a sum that matches the total can still be a
double-count.* Equality is **not** a partition proof; disjointness and exhaustiveness must be shown
separately.

**So I re-checked this case properly, and it does hold — for a reason I had not stated:** the bucket
predicate (`head -10 | grep -q '^#if 0'`) is **boolean per file**, so the buckets are disjoint *by
construction*, and `disabled=13 + live=39 = 52 = all files` gives exhaustiveness independently
(overlap: 0 files). ⇒ **The partition control is valid here because the predicate is a per-element
boolean over an enumerated universe — not because the sum matched.** State the reason, or the next
reuse will be the double-count case.

⭐ **Meta-failure to notice:** I praised a control as novel while a stricter form of it sat in my own
store, and I only found that by grepping before writing this file. **The store's failure mode is not
absence — it is silence on the query you actually arrive with.** Same shape as the re-derivation noted
in [[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]].

Related: [[feedback_two_sets_same_count_different_members]] (equal counts, different members),
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] (why a reviewed artifact draws less
scrutiny).
