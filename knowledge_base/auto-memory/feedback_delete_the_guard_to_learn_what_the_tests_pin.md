---
name: feedback_delete_the_guard_to_learn_what_the_tests_pin
description: "A passing suite says nothing about WHICH mechanism it protects. Delete each guard and re-run: on nanoclaw#1127 both recency checks survived deletion at 19/19 while every other guard failed 1-4 tests. Then instrument WHICH branch fired — the concurrency test credited the lock, never the re-check it was presented as proving."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c2e69b60-c9b3-4351-81d9-384c2d923a3b
---

# Delete the guard to learn what the tests actually pin

**Measured 2026-08-06, nanoclaw#1127.** The author shipped 19 tests (up from 7) and named one
mechanism as *"the part that actually fixes defect 1"* — the recency re-check taken inside the lock.
All 19 passed. I deleted each guard in turn and re-ran:

| mutation | result |
|---|---|
| **remove the in-lock re-check** | **19 pass / 0 fail** |
| **remove the outer pre-check** | **19 pass / 0 fail** |
| remove lock acquisition | 18 / 1 fail |
| stamp despite submodule failure | 17 / 2 fail |
| stamp despite pull failure | 18 / 1 fail |
| stale-break: drop age check | 16 / 3 fail |
| stale-break: invert age comparison | 15 / 4 fail |
| `releaseLock` → no-op | 16 / 3 fail |
| `shouldRefresh`: invert TTL comparison | 18 / 1 fail |

Every guard was pinned **except the two the PR was about**. A green suite plus a confident
description read as "verified"; the mutation column is what distinguishes *tested* from
*merely present*.

## ⭐⭐⭐ The second step is the one people skip: instrument WHICH branch fired

Deletion tells you a test doesn't *depend* on a mechanism. It does not tell you what the test was
crediting instead. The author's concurrency test asserted `pulls === 1` across 10 simultaneous boots
and was presented as proof the re-check works. I logged which branch excluded each contender:

```
pulls=1   excluded-by-LOCK=9   excluded-by-RE-CHECK=0
```

All nine were refused by the **lock**, because boot 1 re-enters mid-pull and therefore still *holds*
it — so they never get inside to reach the re-check at all. The re-check's real window is a different
interleaving entirely: B passes the pre-check → A completes and **releases** → B *acquires* → the
re-check sees the fresh stamp. No test reached that ordering.

⇒ **A test asserting the right OUTCOME can be driven entirely by the wrong MECHANISM.** `pulls === 1`
is true either way, so the assertion cannot discriminate. Assert the *observable the mechanism
produces* — here, its distinctive log line — not just the end state.

## When to spend this

Cheap and scriptable: one loop that patches a string, runs the suite, records pass/fail, restores.
Ten mutations took under a minute. Worth it whenever a PR's value rests on a specific guard and the
evidence offered is "the tests pass" — i.e. most compiler/concurrency review. The finding is usually
a **test gap, not a code defect** (the re-check here is correct and load-bearing in production), so
report it as 🟠 fragility: nothing is broken, but nothing stops a future refactor from removing it.

## Sibling rule

The inverse trap is live too: a test that passes on **pre-fix** source pins nothing
(see [[project_nanoclaw_1114_gc_build_size_accounting]] for the differential that catches it, and
[[project_nanoclaw_1065_reclaim_before_wake]] for an instance where the added test did pass on base).
Deletion-of-guard and run-against-base are the two halves of the same question: *what would have to
change for this suite to go red?*

Related: [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must predict *where*
the fault appears) · [[project_nanoclaw_1127_clone_refresh_lock]] (the full instance).
