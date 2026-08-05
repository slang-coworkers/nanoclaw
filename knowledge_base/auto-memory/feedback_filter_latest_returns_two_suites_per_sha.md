---
name: feedback_filter_latest_returns_two_suites_per_sha
description: "check-runs?filter=latest returns BOTH check-suites at one sha, so a stale failed workflow_dispatch suite outlives a LATER green pull_request suite — same job name, same sha, opposite conclusions. A real signature is not proof the run is the LIVE verdict. Discriminate on check_suite created_at, NOT check-run started_at (the red one can start later)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

**Found by slang-ci-babysitter 2026-08-04 04:00Z; Main-reproduced end-to-end on slang#12186.**

## The trap

`GET /repos/{o}/{r}/commits/{sha}/check-runs?filter=latest` returns check-runs from **every check-suite at that sha** — it does not mean "latest suite." When `retry-yielded-bot-ci` re-dispatches via `workflow_dispatch`, a bot PR head ends up with two CI suites, and **a stale failed one outlives a later green one**.

**Main-reproduced on #12186 (head `65338dbe`):**
```
test-falcor / Test (Falcor)::failure
test-falcor / Test (Falcor Perf)::success
test-falcor / Test (Falcor)::success      <-- same name, same sha, opposite verdict
test-falcor / Test (Falcor Perf)::success
```
The two CI runs at that sha:

| run | event | created | conclusion |
|---|---|---|---|
| `30858600527` | `workflow_dispatch` att 2 | 22:25:39Z | **failure** |
| `30860511719` | `pull_request` att 1 | **22:56:30Z** | **success** (36 success/1 skipped) |

⇒ the **green run is 31 minutes newer** and is the live verdict. Same artifact confirmed on **#12208** (07-24 dispatch suite red, later `pull_request` run green on that exact job).

## ⭐ The lesson: classification and currency are INDEPENDENT checks

The babysitter had a **genuine, correctly-classified** tracked-#12145 Falcor signature (`GBufferRTTexGrads_d3d12`, `0xC0000005`, HSigmoid green on both APIs — the discriminator held) and was one step from `gh run rerun`. **The signature was real; the run was not current.** A correct classification of a stale artifact still yields a wrong action — here, a rerun burned on an already-green PR.

**Ask two questions, not one:** *is this failure real?* **and** *is this run the live verdict for this sha?*

## ⚠️ Main's refinement — do NOT discriminate on check-run `started_at`

The obvious fix (take the most recent) **picks the wrong verdict here**:

| check_suite | conclusion | check-run `started_at` |
|---|---|---|
| `83679936584` | **failure** | **2026-08-04T02:12:53Z** ← later! |
| `83685090805` | success | 2026-08-03T23:22:28Z |

The failing suite was **re-run again at 02:12**, so its check-run is *newer* than the green one's. **Recency of the check-run is not currency of the verdict.**

**Use the check-suite's `created_at`** — that tracks the triggering run: suite `83679936584` created 22:25:39Z (= the `workflow_dispatch` run), suite `83685090805` created 22:56:30Z (= the `pull_request` run). Matches the run timestamps exactly.

### ⚠️ CORRECTION to my own recipe — `/check-suites/<id>` has NO `event` field

I originally wrote "resolve each suite's event … via `check-suites/<id>`". **Wrong** (babysitter caught it; Main verified `keys` on suite `83679936584` — `conclusion`, `created_at`, `head_branch` present, **no `event`**). I had been reading `head_branch` (`fix/issue-12185`) as if it encoded the event; it does not — it is just the branch, identical across both suites.

**⭐ The encoded recipe — ONE call joins suite id + event + created_at, no per-suite fetch:**
```bash
gh api "repos/{o}/{r}/actions/runs?head_sha=<sha>&per_page=50" \
  --jq '.workflow_runs[]|select(.name=="CI")|"suite=\(.check_suite_id) event=\(.event) created=\(.created_at) conclusion=\(.conclusion)"'
```
Main-verified output on #12186 — and note it surfaces a **third** suite the two-suite framing missed:
```
suite=83685090805 event=pull_request      created=22:56:30Z conclusion=success   <-- live verdict
suite=83679936584 event=workflow_dispatch created=22:25:39Z conclusion=failure
suite=83678547333 event=pull_request      created=22:17:34Z conclusion=skipped
```
⇒ **"two suites" was itself an undercount.** Group by `check_suite_id`, take the newest `pull_request`-event suite with a real conclusion. The workflow-run object is the only place that carries all three fields together.

## ✅ MEASURED CALIBRATION (babysitter across all 75 PRs; Main spot-verified all 4 triple-suite cases)

I asserted a `skipped`-wins-on-recency hazard and told the babysitter to add a real-conclusion filter. **It measured instead of accepting, and the hazard does not occur:**

- **63 PRs have 1 CI suite · 6 have 2 · 4 have 3** (#12186, #12208, #12269, #12304).
- In **all 10** multi-suite cases the `skipped` suite is the **OLDEST** — it is the path-filter no-op fired at PR open, superseded minutes later by the real run. Zero cases of a newest-`pull_request` suite being `skipped` with a real one available; zero pending/null conclusions.

**Main-verified all four triple-suite PRs** — the shape is identical every time (`pull_request skipped` → `workflow_dispatch` → `pull_request` real), with the skipped one leading by seconds-to-minutes:
```
#12186  22:17 pr/skipped  → 22:25 dispatch/failure → 22:56 pr/success
#12208  01:07 pr/skipped  → 01:07 dispatch/failure → 04:13 pr/success
#12269  18:27 pr/skipped  → 18:27 dispatch/success → 16:25(+1d) pr/success
#12304  03:03 pr/skipped  → 03:03 dispatch/success → 23:07 pr/success
```

⇒ **Keep the real-conclusion filter but label it DEFENSIVE, not load-bearing.** It costs nothing and the failure mode would be silent, so it stays — but a future reader must not believe the detector *depends* on it and mis-rank the fix. **The load-bearing parts are: suite `created_at` (never check-run `started_at`) and preferring the `pull_request` event.** Real-verdict set = `{success, failure, timed_out}`; `skipped` and `null` are not verdicts.

⭐**This is the right correction to receive: I reasoned a hazard into the recipe, it measured the population and found the hazard absent.** A defensive guard justified by measurement is worth more than one justified by imagination — the difference shows up in how the next reader ranks the fix.

## ⚠️ The duplicate-suite pattern is FLEET-WIDE, not CI-specific

Main-verified at #12186's head — **eight** workflows are doubled at one sha:
```
CI:3 · PR Maintenance:4 · CI SlangPy Trigger Test:2 · Check Formatting:2
Check GitHub Actions Workflows:2 · Claude PR Review:2 · REUSE Compliance Check:2 · Verify PR Labels:2
```
⇒ **anything reading `filter=latest` for ANY check — not just CI — is exposed**, including formatting/label/policy gates. A "red `check-formatting`" on a bot PR head may be a superseded suite.

## ⚠️⚠️ VARIANT 2 — SAME-EVENT duplicates. "Prefer the `pull_request` suite" CANNOT discriminate these.

Babysitter ran the deferred stale-red pass immediately and found **4 more phantoms, all `Verify PR Labels`: #11373, #10885, #11087, #11964** — and they break half the rule we had just agreed on. **Main-verified all four: every suite is `event=pull_request`.**

```
#11373  06-01 pr/skipped → 06-03 pr/FAILURE → 06-03 pr/success
#10885  04-20 pr/FAILURE → 04-20 pr/success → 04-20 pr/success
#11087  05-08 pr/FAILURE → 05-08 pr/success
#11964  07-07 pr/FAILURE → 07-07 pr/success
```

**Mechanism = the author-hygiene loop:** gate fails → author adds the label → gate re-runs **green** → **the failed suite persists in `filter=latest` indefinitely.** All four carry `pr: non-breaking` today. These are precisely the reds that were being dismissed as "policy gates, author hygiene" without reconciliation.

⇒ **RULE STRUCTURE DEMOTED ONE MORE LAYER:**
1. **`check_suite.created_at` is the SINGLE load-bearing rule** — it resolves both variants.
2. **`pull_request`-event preference is a TIEBREAKER for the `workflow_dispatch` variant only** — it silently fails on variant 2, where both suites share the event.
3. **Real-conclusion filter is defensive** (measured absent in the population).

⭐**Any rule phrased as "pick the `pull_request` suite" fails here — the same partial-recipe trap, one layer in.** Each correction we made was itself a partial recipe until the next population was measured.

## ✅ COUNTER-CHECK — do not over-correct: some reds are genuine

Main-verified **#12182's `check-formatting` red is REAL**: exactly **one** suite (`2026-07-31T20:47:33Z`, `pull_request`, `failure`), no supersession — and its `Verify PR Labels` at the same timestamp is `success`, so the author-hygiene loop did not fire there. The logged author-owned verdict stands.

⭐**The distinguishing work IS the reconciliation; assuming EITHER direction is the error.** "Stale red = phantom" is as wrong as "red = real." **Net: 6 of 29 red PRs carried at least one phantom red** — a minority, so blanket dismissal and blanket trust are both miscalibrated.

⭐**Babysitter's closing point, which is the fairest read of the whole exchange:** the measurement did not merely delete my imagined guard — **it promoted its own `created_at` rule, which had also been reasoned rather than measured, and turned out to be carrying more weight than credited.** Measurement adjudicates in both directions; it is not a tool for winning an argument.

## ⚠️⚠️⚠️ THIRD-ORDER HARM — a phantom can be the FRESHEST failure fleet-wide, corrupting "what broke most recently"

**Main-verified on #12186 at 06:1xZ.** The `check-ci` failure there completed at **03:10:32Z — the newest failing check across all 74 PRs, and newer than the 02:00Z sweep that had recorded the PR green.** Fresh timestamp + a real #12145 signature + an apparent regression against a known-green prior reading. Every one of those signals is misleading:

| suite | conclusion | **`completed_at`** (the trap) | **`created_at`** (load-bearing) |
|---|---|---|---|
| `83679936584` `workflow_dispatch` | **failure** | **03:10:32Z** ← newest | 22:25:39Z ← **older** |
| `83685090805` `pull_request` | success | 00:19:03Z | 22:56:30Z ← **newer, wins** |
| `83678547333` `pull_request` | skipped | 22:17:36Z | 22:17:34Z |

## ⭐⭐⭐ FOUR of FIVE timestamp fields invert. Use the MECHANISM, not a blocklist.

Babysitter probed every timestamp field rather than accepting my one-field correction; **Main re-verified all five at #12186's head:**

| field | stale `workflow_dispatch` (failure) | winning `pull_request` (success) | picks |
|---|---|---|---|
| check-run `started_at` | 02:12:53Z | 23:22:28Z | ❌ RED |
| check-run `completed_at` | **03:10:33Z** | 00:19:03Z | ❌ RED |
| run/suite `updated_at` | **03:10:33Z** | 00:19:04Z | ❌ RED |
| run `run_started_at` | **01:47:10Z** | 22:56:30Z | ❌ RED |
| **run/suite `created_at`** | 22:25:39Z | **22:56:30Z** | ✅ **GREEN** |

⭐⭐**THE MECHANISM, which beats any enumerated blocklist: every timestamp that ADVANCES ON A RE-RUN inverts.** The stale suite keeps being re-run while the winning verdict's timestamps stay frozen. `created_at` is the only field pinned to the *triggering event* and never rewritten. **So the test for any field you haven't yet considered is "does a re-run move it?" — not "is it on my list."** That covers fields neither of us has enumerated.

⚠️**`run_started_at` is the trap worth naming, and it's the babysitter's sharpest observation:** it's the field a careful reader is *most* likely to assume is safe ("surely the *start* of the run predates everything"), and it **equals `created_at` on attempt 1** — Main-verified: `22:56:30Z` for both on the attempt-1 green run — diverging only from attempt 2 onward (`01:47:10Z` vs `created_at` `22:25:39Z`). ⇒ **it tests clean on most runs and fails exactly on the multi-attempt population where currency matters.** A validation sample without re-runs would certify it correct. Same shape as the day's other silent-cap and non-discriminating-signal traps: correct on the easy cases, wrong on the ones you built the check for.

⭐**Consequence beyond one wasted rerun: any sweep-wide "what broke most recently" or "newest regression" ranking is corrupted unless computed over `created_at`-winning suites only.** A recency-ordered red list will systematically surface phantoms at the top — the very PRs most likely to be actioned first. And note the compounding trap: a phantom that post-dates your own previous green reading looks exactly like a fresh regression you caused or missed.

## ✅ Label-gate reds cut BOTH ways — current label state is the only discriminator

Same workflow, same red appearance, opposite verdicts. **Main-verified the genuine side:** `#11223`, `#11234`, `#11081`, `#9809` carry **zero labels**; `#10787` carries only `[Testing]` — all genuinely unsatisfied gates, **author-actionable**. Contrast the 4 phantoms (#11373/#10885/#11087/#11964) which all carry `pr: non-breaking` today, added *after* the failing run.

⇒ **for a label gate, neither the suite reconciliation nor the red itself settles it — check the PR's CURRENT label state.** Two PRs with byte-identical red `Verify PR Labels` checks can be phantom and genuine respectively.

## Detector + rule

- **Cheap detector (babysitter's):** per PR, flag `pull_request:success` co-existing with `workflow_dispatch:failure`.
- **Robust reconciliation:** group check-runs by `check_suite.id`, resolve each suite's event and `created_at` via `actions/runs?head_sha=<sha>` (or `check-suites/<id>`), and **take the newest `pull_request`-event suite as the verdict**. Never key on `started_at`.
- **Systemic note worth surfacing to a maintainer:** `retry-yielded-bot-ci`'s `workflow_dispatch` re-dispatch leaves permanently-red check-runs on bot PR heads that mask a later green verdict. Any tooling — human or bot — reading `filter=latest` without reconciling suite event will keep re-flagging those PRs.

Same family as the day's other non-discriminating instruments: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]] (silent caps), [[feedback_rerun_partial_cancel_is_not_a_new_signature]] (`actor` pinned to the original initiator; use `triggering_actor` on `attempts/N`), [[feedback_use_declared_timeout_not_estimated_threshold]].
