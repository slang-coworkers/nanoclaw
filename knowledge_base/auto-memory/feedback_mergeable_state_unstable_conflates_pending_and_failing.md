---
name: feedback_mergeable_state_unstable_conflates_pending_and_failing
description: "GitHub's mergeable_state=unstable means 'not all checks green' — which covers checks STILL RUNNING as well as FAILED. I published 'unstable = failing CI, NOT conflicts' as a two-way rule; measured 2026-08-10 it was unstable with ci in_progress."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3ae3be2a-17e7-4f5f-9f56-e631d8b51b44
---

# `mergeable_state: "unstable"` conflates PENDING with FAILING

⛔ **TRIGGER: you are about to read a verdict out of `mergeable_state`.** It is a
**three-way** distinction collapsed into one word per state, and `unstable` covers **both**
"a check failed" and "a check has not finished". Neither implies a merge conflict
(that is `dirty`).

## The correction to my own gloss

At nanoclaw#1136 head `1e498ed2` (2026-08-06) I measured `unstable` with `ci` and `check`
both `conclusion: failure`, and published:

> *"`mergeable_state: "unstable"` = failing CI, NOT conflicts."*

The **not-conflicts** half is right and worth keeping. The **failing** half was an
over-read of one instance. Measured at head `2c01bf70` (2026-08-10T21:30Z, ~8 s after the
push):

```
gh api .../commits/2c01bf70…/check-runs --jq '.check_runs[]|{name,status,conclusion}'
ci     status=in_progress  conclusion=null     ← unstable BECAUSE PENDING
guard  status=completed    conclusion=success
check  status=completed    conclusion=success
```

Same word, opposite meaning: nothing had failed. Had I re-applied my own rule I would have
reported "CI is red again" on a PR whose checks were merely still running — and the
regression would have been fabricated entirely by my prior note.

⇒ ⭐⭐⭐ **`status` is the field that separates the two; `conclusion` is `null` until
`status == "completed"`.** Never infer pass/fail from `mergeable_state`, and never from
`conclusion` alone without checking `status` — a `null` conclusion is "not yet", not "no
problem".
⇒ ⭐⭐ **A freshly-pushed head is PENDING by default.** Compare the check's `started_at`
against the push time before reading any verdict. Minutes-old head + `unstable` ⇒ presume
pending and **wait**, don't report.
⇒ ⭐⭐⭐ **The generalization error: I derived a two-way rule from a one-sided sample.** I
had only ever seen `unstable` alongside failures, so I wrote the definition as "= failing".
One instance can establish "X can mean A"; it can never establish "X means A". Same shape
as [[feedback_a_mechanism_does_not_carry_its_prescription]] — correct about what it named,
wrong about what it covered (the ANCHOR-F carve-out pattern: a rule aimed at the wrong
scope).

## Reference

| `mergeable_state` | means |
|---|---|
| `clean` | mergeable, all required checks green |
| `unstable` | mergeable, **non-required check failed OR still running** |
| `blocked` | mergeable, but a required gate/review is unsatisfied |
| `dirty` | **merge conflict** — the only conflict state |
| `behind` | base advanced, strict-update branch protection |
| `unknown` | background mergeability computation not finished — re-poll |

⚠️ Also measured on this PR: `gh api .../commits/<sha>/status` → `{state:"pending",
total_count:0, statuses:[]}` on a repo that uses **check-runs only**. That `"pending"` is an
artifact of an empty legacy-status set, **not** a real pending gate — a second way to
manufacture a false red. Use `/check-runs`, not `/status`, when `total_count` is 0.

## Also: a `head -N` after a pipe destroys the exit code you were about to trust

Same session, adjacent error. I ran `… | grep -nE '<pins>' | head -20; echo "(exit=$?)"` and
got `(exit=0)` with no output — then nearly read that as "grep confirmed zero pins". **`$?`
was `head`'s**, which is 0 regardless. ⇒ ⭐⭐ **count with `grep -c` into a variable, and run
a POSITIVE CONTROL on a pattern you know is present** (here `^\+import ` → 34 hits, against
target 0 and 9 removed-only pin lines) — otherwise a zero is indistinguishable from a
mis-typed regex or an empty input. See [[feedback_zero_hit_grep_has_never_one]] family and
[[feedback_a_control_validates_the_instrument_never_the_target]] (the control proves the
instrument, never that I read the right diff).
