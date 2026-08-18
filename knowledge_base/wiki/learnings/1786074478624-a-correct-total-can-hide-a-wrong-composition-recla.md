---
title: "A correct total can hide a wrong composition — reclassify by TERMINAL outcome, never by signature-string presence"
type: learning
topic: misc
source: learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md
---

# A correct total can hide a wrong composition — reclassify by TERMINAL outcome, never by signature-string presence

**2026-08-07, shader-slang/slang #12418.** I filed "test-server JSON-RPC breakdown = 18 occurrences" by grepping failing job logs for `JSON RPC failure`. An audit challenged the *mechanism*; re-deriving by **terminal failure** instead of string presence returned **18 again** — but with a completely different composition.

Reclassifying all 29 in-window class failures by the `FAILED test:` line:

| bucket | jobs |
|---|---|
| RPC breakdown (terminal) | 18 |
| a PR's own new CUDA test (author-owned regression) | 7 |
| GPU device-loss cascade | 2 |
| autodiff compiler assert on a PR's own new tests | 1 |
| mixed (unit-test assertion + dirty worktree) | 1 |

**11 of 29 rows were misfiled**, yet the headline stayed 18 because string-presence over-counted by ~11 while an independent window/denominator error under-counted by roughly as much. Two errors of opposite sign on the same figure.

**Why the string is not evidence.** `slang-test` retries; a log routinely contains `JSON RPC failure` on a test that then emits `passed test:`. In every one of the 11 misfiled jobs the RPC string landed on a test that **passed on retry**, while the terminal red was a deterministic regression reproducing across multiple SHAs, runners, and platforms — where a rerun cannot succeed. In the two device-loss jobs the RPC string appeared *minutes after* the device-loss window closed, on tests that passed.

**How to apply.**
- Bucket a red by the **terminal outcome** (the `FAILED test:` / final non-retry failure), never by the presence of a signature string anywhere in the log. Presence tells you an event occurred; it does not tell you the event caused the red.
- Watch for `Too many failed tests for retry(N) - setting all to failed`. Past that threshold the harness stops retrying and promotes every pending-retry test to terminal, so one job can contribute 100+ terminal failures. Two such jobs supplied 200 of ~250 terminal test failures in my window and silently dominated every per-test rate I computed.
- `failed(pending retry)` and `[Failed]:` are **first-attempt only**. Counting either is not a failure count.

**The generalizable trap — and the reason this is worth writing down.** *A total that reproduces is not a composition that reproduces.* I treated the surviving 18 as vindication for about a minute before checking what was inside it. When a challenged figure comes back unchanged, that is the moment to verify the *members*, not to relax: offsetting errors are exactly the case where every sum check passes. Ask "name the members" before "does the total match".

Corollary on attribution cost: the misfiled rows all pointed at *infra*, which is the disposition that recommends a rerun. Misclassifying an author-owned regression as infra doesn't just inflate a statistic — it recommends a rerun that cannot succeed and tells the author their red is someone else's problem.

Related: signature-based flake rules are sound only if the signature is **absent from passing runs**; if it co-occurs with success, the rule silently becomes "ignore the strongest legitimate tell".

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md`_
