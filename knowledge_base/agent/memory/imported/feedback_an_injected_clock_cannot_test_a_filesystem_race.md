---
name: feedback_an_injected_clock_cannot_test_a_filesystem_race
description: An injected nowMs compared against a REAL file mtime fabricates races that cannot happen. My in-process probe showed two boots both acquiring a lock; 120 real processes with real Date.now() gave exactly 1 winner every time. Publish the negative result WITH the finding when you cannot make a latent race fire.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c2e69b60-c9b3-4351-81d9-384c2d923a3b
---

# An injected clock cannot test a filesystem race

**Measured 2026-08-06, nanoclaw#1127.** Reviewing a `mkdir`-based lock with a stale-break path
(`stat` → judge stale → `rmSync` → `mkdirSync`), I wrote an in-process probe with an injected
`nowMs` and got:

```
B1 acquired=true  B2 acquired=true   (both true => mutual exclusion LOST)
```

That looked like a 🔴. It is an **artifact**. The staleness test compares an *injected* `nowMs`
against the lock directory's **real** mtime, so a fabricated epoch makes every lock look
arbitrarily old — including the one the winner just created. Both callers "see" a stale lock
because the clock says so, not because a race occurred.

The author had documented this exact trap in their own test file, and had hit it themselves:
*"the staleness tests first compared an injected fake epoch against the lock directory's real mtime,
so the arithmetic was meaningless and one test failed for the wrong reason."*

## ⭐⭐⭐ The valid instrument is real processes on the real clock

Rebuilt production-faithfully: a genuinely 11-minute-old orphan (`os.utime(p, now-660)`), 15
separate processes gate-synchronised on a sentinel file, each calling `acquireLock(clone, Date.now())`
— the production call, no injection. 8 trials:

```
trial 1..8: 1 of 15 boots acquired the lock   →  120 boots, 8 winners, 0 double-acquires
```

Then 40 boots × 3 trials with the branch instrumented: **the BREAK path is entered by exactly 1 boot
per trial** (39 refused). The `rmSync`→`mkdirSync` gap is sub-millisecond and nothing landed in it.

⇒ **Any test that mixes an injected clock with filesystem timestamps is measuring its own injection.**
Either inject *both* sides (pass the mtime in too), or derive the fake time from the file's own mtime
(`lockMtime(clone) + STALE + 1`), or use the real clock and manufacture age with `utime`.

## ⭐⭐ Publish the negative result WITH the finding

The race is real by inspection — check-then-act with a delete between — and I still reported it, but
as 🟠 carrying its own refutation: *"I tried to make it fire and could not; here are 120 boots."*
I also bounded the damage rather than asserting it: two concurrent `git pull --ff-only` on one clone
both returned `rc=0` with a correct tree, because git holds its own `index.lock` — so the worst case
is duplicated remote traffic, not corruption.

A structural finding shipped without its severity measurement invites the author to either
over-react (rewrite a working lock) or dismiss the whole review when they fail to reproduce it.
Naming both — *the window exists* and *I could not hit it in 120 attempts* — is what makes it
actionable as a latent cleanup instead of a false alarm.

This is the same asymmetry as [[feedback_mechanism_must_predict_observed_coordinates]]: an
over-stated finding against correct code does more damage than a missed one, because it licenses a
change.

Related: [[project_nanoclaw_1127_clone_refresh_lock]] (full instance, incl. the fixture that isolates
a submodule-only failure) · [[feedback_delete_the_guard_to_learn_what_the_tests_pin]] (the sibling
technique used on the same PR).
