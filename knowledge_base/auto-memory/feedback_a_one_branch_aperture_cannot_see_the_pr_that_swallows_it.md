---
name: feedback_a_one_branch_aperture_cannot_see_the_pr_that_swallows_it
description: A watcher keyed to one branch (pulls?head=fix/issue-N) is blind BY CONSTRUCTION to a superseding PR on another branch that CONTAINS its head — no number of fields about that one branch can fix a scope defect. 4th latch omission on the same guard; each prior fix widened the field set and the next defect was another unenumerated field.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4fe90547-8c04-4765-bc18-24b1dabf6cd0
---

# A one-branch aperture cannot see the PR that swallows it

Measured 2026-08-06 19:0xZ on guard `i12371-pr-guard-0175` (slang#12371).

## What happened

The guard woke on its 4-hour heartbeat floor with `prior_fingerprint` **byte-identical** to
`fingerprint`. By its own documented rule that is a silent wake: emit nothing. Re-measured anyway,
and **two of the chain's most decision-relevant events of the entire day had happened in the
preceding 45 minutes**, with every latch field correct and unchanged through both:

1. `jkwak-work` **`assigned`** himself to the issue 18:16:13Z and **`milestoned`** it 18:16:28Z — the
   first non-bot events in that issue's whole timeline. The latch carried a *comment* count, so an
   assign / milestone / label / close-reopen by a human moved **nothing**.
2. Draft PR **#12408** opened 18:30:44Z on branch **`fix/issue-12383`**, a **strict descendant** of
   the watched PR's head (`compare f93eb4f7...d8dcbe35` → status ahead, **ahead_by 2, behind_by 0**;
   its commit list contains the watched PR's three shas verbatim). It rewrites the same code block
   and builds the *other* option the operator was being asked to choose between.

## The rule

⭐⭐⭐ **A watcher keyed to one branch is blind by construction to the work that swallows it.**
`pulls?head=fix/issue-12371` cannot return a PR on `fix/issue-12383` **no matter how many fields it
carries about that one branch.** This is a *scope* defect, not a *field* defect — and the two fail
identically from inside: both present as "unchanged".

⇒ **When a probe reports "unchanged", the honest reading is "none of the things I enumerated moved,
within the aperture I happened to query."** Ask both halves separately: *is my field set complete?*
and *is my aperture the right shape?* Widening fields is the reflex; widening the aperture is the
one that was needed here.

## Why this is the 4th, and what the sequence teaches

Same guard, four latch defects, and **every fix so far widened the FIELD SET while leaving the
aperture alone**:

| # | when | defect | class |
|---|---|---|---|
| 1 | 06:30Z | fired on a STATE (`pr_exists`) not a CHANGE → 20-min wake loop | no latch |
| 2 | 11:2xZ | the failure path WROTE the latch → one `gh` blip self-sustains a loop | latch poisoning |
| 3 | 15:07Z | PR-side reviews/review-comments not in the fingerprint | field omission |
| 4 | 19:0xZ | issue-timeline non-comment events; superseding PRs on other branches | field + **aperture** |

⭐⭐ **Defects 3 and 4 share a property that makes them uniquely hard: no failure-injection test can
surface them, because the probe never runs.** Breaking a probe I *have* is testable; a probe I never
wrote has no failure mode to inject. The only detector is periodically re-measuring **outside** the
latch and comparing against what the latch claims — which is exactly what caught this one, and is
the reason the heartbeat floor must never be removed in favour of pure change-detection.

## The fix, and the control that makes it worth something

Two probes appended to the fingerprint as `|iev=N|xprs=a,b`:

- `iev` — non-bot events on the **issue timeline** (not comments), filtered `actor.id != 274397474`.
  ⚠️ **Filter by id, never login**: `login=nv-slang-bot` type=User id=286953280 is a *different*
  account, and a login filter silently drops its events.
- `xprs` — sorted unique set of PR numbers cross-referencing the issue. This is the aperture fix: it
  finds a superseding PR *via the issue*, which every related PR touches, instead of via one branch.

Both shape-checked (integer / empty-or-digits-and-commas) and **bail without touching the latch** —
per [[feedback_a_latch_its_own_failure_path_can_write_is_not_a_latch]].

✅ **T6 is the control that matters: seed `xprs=12382` — the store's exact state at 18:29Z, one
minute before the dark event — and the guard wakes.** A new field being *present* proves nothing; a
new field **replaying the event it was blind to** proves it works. Also run: T1 wakes on the widened
set, T2 silent immediately after, T3 timeline-404 via a `gh` stub ⇒ silent with latch+lastwake
**md5-identical**, T4 stored value uncorrupted, T5 `iev` positive control.

⭐⭐ `lastwake` restored to its true value after testing — **a test of a budgeted mechanism must not
consume the budget it measures**, or the next real heartbeat lands early and I read my own test as
chain activity.

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[project_12371_spirv_prelink_validation_buffer]], [[project_12383_spirv_validation_before_spvopt_strip]].
