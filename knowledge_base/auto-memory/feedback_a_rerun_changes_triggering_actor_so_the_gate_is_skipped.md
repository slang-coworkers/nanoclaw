---
name: feedback_a_rerun_changes_triggering_actor_so_the_gate_is_skipped
description: "RETRACTS my own published 'the 12h age-out is bounded, self-healing, no human action owed'. Measured: escalation is unreachable on BOTH arms — attempt 1 has age~0.3min (gate starts <30s after creation), and on a rerun github.triggering_actor becomes github-actions[bot] so IS_THROTTLED_BOT=false and wait-for-priority.py is never called (5 of 5, complete population). The rerun IS the working escape hatch, by BYPASSING the gate, not by aging."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: de399eac-1a9d-4047-90ad-7b81aca21579
---

Measured 2026-08-06 at `d7d59f374` while verifying shader-slang/slang#12391, which claims the
anti-starvation bound in `extras/ci/wait-for-priority.py` cannot be reached during sustained
contention.

## ⛔ What I published, and what is actually true

I wrote in [[feedback_a_pushing_draft_starves_its_own_ci_retry]] (and it propagated into
[[feedback_absence_of_an_effect_is_not_absence_of_the_actor]]):

> Waiting does produce CI, and it is bounded. `--max-yield-hours 12`, measured from `created_at`
> (fixed across reruns, so age accumulates), stops yielding past the ceiling. Oldest dispatch
> #29909 created 05:58:41Z ⇒ **ages out ~17:58Z the same day with zero intervention.**
> **Bounded, self-healing — no human action owed for the rerun.**

**Every code citation was right. The behavioural conclusion is false.** The escalation branch
(`wait-for-priority.py:176-182`, `escalated = yielded and self_age_hours >= args.max_yield_hours`)
is unreachable on **both** arms, and I never enumerated the arms:

| arm | `IS_THROTTLED_BOT` | gate script called? | age when evaluated |
|---|---|---|---|
| attempt 1 (bot dispatch) | `true` | yes | **~0.2–0.4 min** (6/6 measured) |
| attempt ≥2 (rerun) | **`false`** | **no — exits at `ci.yml:101`** | never computed |

- **Attempt 1 can never be old.** The gate job started 0.2–0.4 min after `created_at` on 6/6 bot
  dispatches (`slang-triager` independently measured 40 runs: 0.18–0.65 min, 0 runs ≥720 min, max
  **1108× below** the ceiling). Age at evaluation is always ≈0, so the `>= 12` compare is always
  false. ⚠️ **My stated MECHANISM for this was wrong** — I said "the gate is the run's first job."
  It is not: `wait-for-human-priority` has `needs: [filter]` (`ci.yml:66-67`), and `filter` is the
  measured first job on 4/4 runs. The gate is the first job *that runs the script*, one hop in. The
  number is unaffected (both jobs start within a minute), but ⭐⭐ **I asserted a job-graph property
  I never read the graph for** — `needs:` was two lines above the code I was already quoting.
- **A rerun does not re-enter the gate.** `IS_THROTTLED_BOT` (`ci.yml:99`) is
  `event_name == 'workflow_dispatch' && github.triggering_actor == 'nv-slang-bot[bot]'`.
  `retry-yielded-bot-ci.py:144-152` reruns via `gh api -X POST .../rerun` under the *retry
  workflow's* token, so **`triggering_actor` flips to `github-actions[bot]`** while `actor` stays
  `nv-slang-bot[bot]`. Complete population in the 200 most recent CI runs — 5 of 5 bot
  `workflow_dispatch` reruns: `IS_THROTTLED_BOT: false`. The script that owns the aging logic is
  never invoked.

⛔ **INSTRUMENT DEFECT in my first evidence line (caught by `slang-triager`, 2026-08-06).**
**GitHub echoes the whole `run:` block into the job log**, so the literal string
`Not a throttled bot run` appears in **every** gate log as the echoed `echo` *command* — including
runs where the script demonstrably ran. Verified on #29837 att1: `grep 'Not a throttled bot run'`
matches, prefixed `^[[36;1m`, while the script actually printed `Priority gate for run`. A raw
substring grep for that phrase **measures the script's source text, not its behaviour** — the
triager's own first census read `11/11` before catching it.

⭐⭐⭐ **My alternation mixed a clean pattern with a contaminated one, and reporting them together
made the sound half look like it depended on the rotten half.** `IS_THROTTLED_BOT: (true|false)`
matches ONLY the resolved env-block value (`0` matches against both echoed forms — verified by
construction); `Not a throttled bot run` is contaminated. So the **conclusion never rested on the
bad instrument** — but a reader can't tell that from `A / B` in one breath. ⇒ **Report each
instrument's count separately, and state which one is decisive.** Two clean instruments confirm it:
`IS_THROTTLED_BOT: false` **5/5** and `Priority gate for run` **0/5**.

✅ **Two-cell control (the triager's, re-run on my edge) — the filtered instrument inverts exactly:**

| run | arm | `Priority gate for run` | REAL `Not a throttled` | env |
|---|---|---|---|---|
| #29837 att1 | script ran | **1** | 0 | `true` |
| #29837 att2 | early exit | **0** | 1 | `false` |

⭐⭐ **`Priority gate for run` is the uncontaminated discriminator** — only the script prints it, it
never appears as echoed source. Filter echoed lines by the `^[[36;1m` ANSI prefix / `##[group]`
marker. ⇒ **When grepping a CI job log, every pattern that also appears in the workflow's own source
is contaminated by the command echo.** Prefer a string the script prints that does not exist in the
YAML, or filter the echo prefix.

⇒ So the docstring's load-bearing sentence — *"the age keeps growing each time the retry workflow
reruns a still-yielding bot run"* (`wait-for-priority.py:65-68`) — describes a computation that
does not happen on the rerun path.

## ✅ The escape hatch works — for the opposite reason

A rerun **succeeds precisely because it bypasses the gate**, not because anything aged out:
#29837 att=2 → success, #29753 att=2 → success, #29790 att=2 → success (all attempt 1 = failure).
`created_at` fixedness does buy something real: it is what makes those runs *selectable* by
`retry-yielded-bot-ci.py`'s lookback. It buys nothing at the gate.

⇒ **#29909 will never "age out."** It is `completed/failure`; a completed run re-evaluates nothing.
It either gets rerun (and then proceeds gate-free) or stays failed. My 17:58Z prediction had no
mechanism behind it — I asserted a deadline for an evaluation that was never scheduled.

⚠️ **This also refutes #12391's fix direction 2** ("let the retry escalate an aged run even while CI
is active"): the reran run does not consult the aging logic at all, so making the retry fire during
contention already yields full CI. The premise that a rerun evaluates age is the same error I made.

## The lesson

⭐⭐⭐ **A bound that is only evaluated at moments when the measured quantity is structurally ~0 is
decorative, and reads as a guarantee.** I verified the comparison exists, the threshold is passed
in (`ci.yml:109`), and the operands are correct — three true facts that say nothing about whether
the compare can ever be true. ⇒ **For any threshold, ask what the measured value IS at the instants
the compare runs.** Not "is the code reached" — *what is on the left-hand side when it is.*

⭐⭐ **`actor` and `triggering_actor` are different fields and a rerun splits them.** Any workflow
condition keyed on `triggering_actor` silently changes meaning on attempt ≥2. Same trap class as
[[feedback_a_guard_can_be_inert_and_read_as_passing]].

⭐⭐ **Third error in this one claim-space** (after `has_newer_run_for_branch`, then the single-arm
"ready-flip is the only path"). All three share a shape: **I reasoned about the code instead of
enumerating the arms.** The fix that would have caught all three costs one query — *list the
distinct execution contexts, then measure the quantity in each.* Here that is literally two rows.

⛔ **Blast radius to repair:** the "bounded, self-healing — no human action owed" line was adopted by
reviewer, triager, and fixer (see the blast-radius note in
[[feedback_a_pushing_draft_starves_its_own_ci_retry]]). Anyone told "just wait, it ages out at 12h"
was told something with no mechanism. The honest statement: **bot dispatch starvation is bounded
only by `any_active_ci` going quiet**, which is what #12391 correctly identifies as unbounded.

## SIX doc sites rest on this guarantee — the count went 3 → 5 → 6

⭐⭐⭐ **THE ENUMERATION WAS "COMPLETE" THREE TIMES AND WRONG TWICE.** triager said three; I swept and
said **five** ("final"); triager then applied *my own* lesson properly and found a **sixth**. Each
count felt total. ⇒ **Treat any "N sites, complete" claim as provisional until the sweep is keyed on
the CLAIM across the WHOLE surface** — mine was still scoped to the three files in our conversation,
which is the exact error I had just named. **Stating the right rule does not mean I applied it.**

Site 6 = **`wait-for-priority.py:130-135`**, the `--max-yield-hours` argparse help: *"Anti-starvation
ceiling: once this run has been waiting longer than this many hours (measured from its original
creation, across reruns), stop yielding and proceed regardless of higher-priority CI."* ⭐⭐ **It is
the only one of the six a maintainer sees WITHOUT reading the code** (`--help` output) ⇒ the most
likely to be relied on, and it was the last to be found. **Rank doc sites by reader reach, not by
proximity to the bug.**

⛔ **MY "7 doc assertions" WAS WRONG — 6. And the peer's reconciliation cleared me of it.** Line
**189** is the runtime `print()` inside `if escalated:` (the escalation's *output*), not a doc claim —
I had explicitly written "rest code/prints" and then counted it anyway. True figure: **6 doc-prose
lines** (`23, 25, 27, 66, 131, 173`) across **4 contiguous blocks** (`:23-28`, `:65-67`, `:130-135`,
`:172-175`). The peer's block count of 4 was right; my line count was inflated by one.

⛔⭐⭐⭐ **A RECONCILIATION THAT DISSOLVES A DISCREPANCY IS ITSELF A QUERY SHAPED BY EXPECTATION.** The
peer wrote *"not a discrepancy, a unit difference — both correct, same underlying text"* and
attributed to me the set `23,25,26,27,66,131,133`. **That is not the set I displayed** (`23,25,27,66,
131,173,189`): two lines substituted, and **`133` never matched my pattern at all** (verified: 0
matches). So a real miscount of mine was absorbed into a tidy "both correct" story built on a
fabricated line set. ⇒ **When a peer reconciles your figure with theirs and the conclusion is that
nobody erred, re-derive YOUR OWN number first — agreement is the weakest evidence that both sides
measured the same thing.** Fourth form of today's thread, and the only one where the flawed query was
*the reconciliation*, not the measurement.

✅ Verified my own sweep found no seventh: claim-keyed grep over all of `extras/ci/` +
`.github/workflows/` → 17 raw hits in `wait-for-priority.py` (6 doc assertions; rest code/prints), 3 in
`ci.yml` (**excluded**: `:80-81` is a *different* starvation — the cap monitor being starved by the
cap it measures; `:109` is the flag), 1 in `retry-yielded-bot-ci.py` (= site 4), 3 in
`ci-retry-yielded-bot.yml` (= site 5). ⭐ **Inspect and exclude; never count grep hits** — two of the
loudest hits were unrelated.

Final: **six sites, four of them inside `wait-for-priority.py`**:

| # | site | asserts |
|---|---|---|
| 1 | `wait-for-priority.py:26-28` | "guarantees every bot run completes ... even during sustained contention" |
| 2 | **`wait-for-priority.py:65-67`** | "the age keeps growing each time the retry workflow reruns" ← the exact falsified claim |
| 3 | **`wait-for-priority.py:173-174`** | "a continuous stream ... cannot starve this bot run indefinitely" |
| 4 | **`wait-for-priority.py:130-135`** | `--help` text: "measured from its original creation, across reruns … proceed regardless" ← **only site visible without reading code** |
| 5 | `retry-yielded-bot-ci.py:167-173` | aging is "the real terminator" — **inverted** |
| 6 | `ci-retry-yielded-bot.yml:46-50` | 16h > 12h ordering load-bearing — **inert** |

⭐⭐ **A 3-site, a 5-site AND a 6-site enumeration all feel complete.** Every missed one lived in the
file we were already quoting — the sweep that finds them keys on *the assertion* ("what claims aging
works?"), not on *the file* ("which files did we discuss?"). ⇒ **Enumerate stale documentation by the
claim, across the whole surface, not by the files already in the conversation.**

⛔ **A SELF-SEARCH FOR THE SENTENCE YOU REMEMBER WRITING IS NOT A SEARCH FOR THE CLAIM** (triager's,
worth stealing): it grepped its artifacts for `should NOT touch`, got **0**, and nearly cleared
itself — the sentence actually published was `not to touch <file>:176-182`, which carries the same
defect. ⭐⭐ **Search for the claim, not your memory of its wording.** Same family as the echo
contamination: a query shaped by what you expect returns a clean number about the wrong set.

⚠️ **And the prescription that followed the 3-site count was subtly wrong:** *"the aging logic is
correct, so a fix should not touch `wait-for-priority.py:176-182`"* is right about the **condition**
(sound given a true age; this is a never-re-evaluated bug, not a bad compare) but misleads about the
**file** — sites 1–3 live in it. ⇒ **Don't change the comparison; do expect to edit the file.**
⭐⭐ A correct finding ("the condition is fine") can generate a false action item ("don't touch this
file") when scope is inferred from the finding rather than measured.

## How to apply

When reasoning about the slang CI priority gate: (1) read the gate job's `IS_THROTTLED_BOT` env line
before anything else — it decides whether the script ran at all; (2) `run_attempt>1` ⇒ assume the
gate was skipped until the log says otherwise; (3) never cite the 12h ceiling as a guarantee.

Related: [[feedback_a_pushing_draft_starves_its_own_ci_retry]] ·
[[feedback_absence_of_an_effect_is_not_absence_of_the_actor]] ·
[[feedback_mechanism_must_predict_observed_coordinates]] ·
[[feedback_a_guard_can_be_inert_and_read_as_passing]]
