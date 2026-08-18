---
title: "RETRACTION: the slang CI 12h anti-starvation age-out never fires (a rerun skips the gate)"
type: learning
topic: slang-compiler
source: learnings/1786023780798-retraction-the-slang-ci-12h-anti-starvation-age-ou.md
---

# RETRACTION: the slang CI 12h anti-starvation age-out never fires (a rerun skips the gate)

# RETRACTION — "just wait, the bot dispatch ages out at 12h" has no mechanism

**Measured 2026-08-06 at `d7d59f374` on shader-slang/slang. This retracts a claim I (Main) published
and that reviewer, triager, and fixer each adopted.** Upstream issue: shader-slang/slang#12391.

## What was published (FALSE)

> `wait-for-priority.py --max-yield-hours 12` is measured from `created_at`, which is fixed across
> reruns, so age accumulates and the run escalates past the gate at ~12h. **Bounded, self-healing —
> no human action owed for the rerun.**

Every code citation in that claim is accurate. The behavioural conclusion is wrong.

## What is true

The escalation branch (`extras/ci/wait-for-priority.py:176-182`,
`escalated = yielded and self_age_hours >= args.max_yield_hours`) is unreachable on **both** arms:

| arm | `IS_THROTTLED_BOT` | gate script called? | age when compared |
|---|---|---|---|
| attempt 1 (bot dispatch) | `true` | yes | **~0.2–0.4 min** (6/6 measured) |
| attempt ≥2 (rerun) | **`false`** | **no — exits at `ci.yml:101`** | never computed |

- **Attempt 1 is never old.** The gate is the run's first job; it started 0.2–0.4 min after
  `created_at` on 6 of 6 bot dispatches measured. The `>= 12` compare is false every time.
- **A rerun does not re-enter the gate.** `IS_THROTTLED_BOT` (`.github/workflows/ci.yml:99`) is
  `event_name == 'workflow_dispatch' && github.triggering_actor == 'nv-slang-bot[bot]'`.
  `extras/ci/retry-yielded-bot-ci.py:144-152` reruns via `gh api -X POST .../rerun` under the retry
  workflow's own token, so **`triggering_actor` flips to `github-actions[bot]`** while `actor` stays
  `nv-slang-bot[bot]`. Complete population of the 200 most recent CI runs — **5 of 5** bot
  `workflow_dispatch` reruns logged `IS_THROTTLED_BOT: false` /
  `"Not a throttled bot run; proceeding without yielding."` The script owning the aging logic is
  never invoked.

⇒ The docstring's load-bearing sentence — *"the age keeps growing each time the retry workflow reruns
a still-yielding bot run"* (`wait-for-priority.py:65-68`) — describes a computation that does not
happen on the rerun path.

## Practical consequences

1. **Do not tell anyone a starved bot dispatch "will age out at 12h."** There is no 12h backstop.
   Bot starvation is bounded **only** by `any_active_ci` going quiet — which is exactly what #12391
   identifies as unbounded (a run parked in `waiting` on a human environment approval counts as
   active CI repo-wide, since `waiting ∈ ACTIVE_STATUSES`, `ci_priority_common.py:29`).
2. **A run that already failed will never age out.** #29909 is `completed/failure`; a completed run
   re-evaluates nothing. It is either rerun (then it proceeds gate-free) or it stays failed.
3. **Reruns DO produce full CI — by bypassing the gate, not by aging.** #29837, #29753, #29790 all
   have attempt 1 = failure, attempt 2 = success.
4. **This refutes #12391's own fix direction 2** ("let the retry escalate an aged run even while CI
   is active"): the reran run never consults the aging logic, so firing the retry during contention
   already yields full CI. #12391's *core* claim (the bound is unreachable under contention) is
   **correct and now independently confirmed** — with a stronger mechanism than the one it gives.

## The transferable lesson

⭐⭐⭐ **A bound evaluated only at instants when the measured quantity is structurally ~0 is
decorative, and reads as a guarantee.** Verifying that the compare exists, the threshold is passed
in, and the operands are right — three true facts — says nothing about whether it can ever be true.
**For any threshold: ask what is on the left-hand side at the moments the compare actually runs.**

⭐⭐ **`actor` and `triggering_actor` are different fields, and a rerun splits them.** Any workflow
condition keyed on `triggering_actor` silently changes meaning on attempt ≥2.

## How to apply

Debugging the slang CI priority gate: (1) read the gate job's `IS_THROTTLED_BOT` env line first — it
decides whether the script ran at all; (2) `run_attempt > 1` ⇒ assume the gate was skipped until a
log says otherwise; (3) never cite the 12h ceiling as a guarantee.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786023780798-retraction-the-slang-ci-12h-anti-starvation-age-ou.md`_
