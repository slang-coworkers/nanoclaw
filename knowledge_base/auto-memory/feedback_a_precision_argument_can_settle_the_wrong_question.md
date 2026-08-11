---
name: feedback_a_precision_argument_can_settle_the_wrong_question
description: "A correct timezone argument picked a bucket key 3x LESS accurate than the one it rejected, because it settled precision and never asked which event the key names. Also: awk without {n} interval support flags 100% of rows."
metadata:
  node_type: memory
  type: feedback
  originSessionId: d4d9b424-19b3-416f-9d9f-6fdd2300d312
---

⛔ **A well-reasoned argument about PRECISION can install a key that is wrong about WHICH EVENT.**
Measured on nanoclaw#1180, 2026-08-10, full population n=280.

The PR bucketed "PRs opened per week" by the epoch-ms in `sess-<ms>-`, and justified it against
the obvious alternative in a comment that is **entirely correct on its own terms**: `created_at`
is stored naive, `new Date()` reads it as local, and that can shift a row across a week boundary.
True. But a session id names **session birth** — when the issue was routed — not when a PR opened.

| key | wrong ISO week vs `gh api pulls/N.created_at` |
|---|---|
| `sessionIdMs` (chosen) | **44/280 = 15.7%** |
| `created_at` (rejected) | 14/280 = 5.0% |

⭐⭐⭐ **The rejected candidate was 3× MORE accurate.** A naive-timestamp read is off by hours; a
wrong-event read is off by weeks (worst case 44 days). The argument optimized the smaller error
and never priced the larger one, because "is this timestamp exact?" and "is this the timestamp of
the thing I am counting?" are different questions and only the first was asked.

⇒ ✅ **When a change defends a key/field choice, restate the LABEL as a sentence and check the key
names that event.** "PRs opened this week" ⇒ the key must be the PR's open time. Any other field
needs an argument for why its offset is bounded, not just an argument that it is precise.

⭐⭐ **The tell that the wrong key is load-bearing: its fallback counter reads 0.** The PR shipped
`fellBackToCreatedAt` for observability — and all 281 live rows parse, so it is **structurally
silent forever** and the less accurate path is in force 100% of the time. A counter that can only
fire on a shape your data never produces is not instrumentation. Ask what makes it non-zero
*before* crediting it.

⚠️ **Companion shape, same PR:** the numerator was restricted to six groups by an explicit
allowlist (right call, with a decoy test), while the denominator counted PRs from *any* group —
17/281, clustered to 31% in one week. ⭐⭐ **A guard on one side of a quotient reads as a guard on
the ratio.** When a metric is `A/B`, the population filter has to be applied to both or stated as
asymmetric on purpose. Combined with the key error the four displayed bars were off −25%..+12% —
same order as the trend the panel existed to show, and **not centred on zero**, so "the errors
roughly cancel" was available and false.

⛔ **MY OWN INSTRUMENT: `awk` here does not support `{n}` interval expressions.**
`awk -F'\t' '$5 !~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/'` matched **nothing**, so it flagged **281 of
281** ground-truth rows as malformed — a false positive over the entire set, in the direction that
voids the measurement I had just spent 281 API calls building. True count was **1**.

⭐⭐⭐ **A 100%-flag result is a claim about the INSTRUMENT before it is a claim about the data.**
Caught only by absurdity: `head` plainly showed valid dates. ✅ Control that settles it in one
line: `echo 2026-08-08 | awk '$0 ~ /^[0-9]{4}-/'` — silence means no interval support; use
`grep -P` or a real regex engine. **Test the pattern against a known-GOOD row before trusting its
verdict on the set.**

Same family as [[feedback_a_closed_set_allowlist_is_the_wrong_shape]] (shape of the predicate, not
its contents) and [[feedback_a_control_validates_the_instrument_never_the_target]].
Instance: [[project_nanoclaw_1180_unit_cost_denominator]].
