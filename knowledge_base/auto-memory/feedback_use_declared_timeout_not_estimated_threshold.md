---
name: feedback_use_declared_timeout_not_estimated_threshold
description: "To judge whether a running job/turn is hung, compare elapsed against the DECLARED bound (workflow `timeout-minutes`), not an estimated one. Slang's spread is 10→360 min, so any single global threshold is wrong for nearly every job. Under the bound = no information. Over it WITHOUT the runner killing it = the genuine anomaly."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

## The rule

Deciding "is this hung?" needs a **time bound**. I first stated it as *"N must exceed plausible turn duration"* — an **estimate**. The babysitter's version is strictly better: **CI publishes the bound, so read it instead of guessing.**

`.github/workflows/*.yml` declares `timeout-minutes` per workflow and **the runner enforces it**. So:

- **elapsed < declared timeout ⇒ NO INFORMATION.** Don't touch it, don't log a stall, don't escalate.
- **elapsed > declared timeout AND the runner has *not* killed it ⇒ the genuine anomaly.** That's the only state worth acting on, and it's cheap to detect.

**Main-verified at HEAD `74c724aec`** (4 spot-checks against the babysitter's table, all exact): `ci.yml` **10** · `ci-slang-test.yml` **80** · `ci-slang-build.yml` **120** · `claude.yml` **360**.

⭐ **The spread is 10 → 360 minutes, so any single global "hung after N minutes" threshold is wrong for nearly every job** — 10 min would false-positive most of CI, 360 would miss a genuinely-wedged `ci.yml` job for six hours. This is the sharper form of the estimate: **the bound is per-job and already written down.**

Same reasoning ruled out timeout expiry on slang#12281 — `Test Slang` had run 23s against a declared 10, so a cancellation at 62s could not be a timeout ([[feedback_rerun_partial_cancel_is_not_a_new_signature]]).

## ⚠️ Where the method has a hole — and my own error finding it

**Not every workflow declares one.** `nightly-slang-coverage-test.yml` has **no `timeout-minutes` at all** (Main-verified) ⇒ for that job there is no declared bound, and the method degrades to the estimate it was meant to replace. **Check for the declaration's presence before relying on it**; absence is a real state, not a lookup failure.

**And a caution about how I nearly mis-recorded this.** I tried to verify "coverage = 240" against `coverage.yml`, got no `timeout-minutes`, and briefly concluded the 240 was undeclared. Wrong twice over: `coverage.yml` **doesn't exist at that SHA** (HTTP 404) — the real files are `ci-slang-coverage-test.yml` (**240**, declared, confirmed) and `nightly-slang-coverage-test.yml` (none). ⇒ **I was measuring a nonexistent file and reading its emptiness as evidence about their claim.** A 404 and an absent field both produce "no match" from a naive grep. **Confirm the file exists before treating its silence as data** — same family as the day's other absence-claim failures, and note that `curl -s` on raw.githubusercontent returns a *404 body*, not an error, so the grep just finds nothing.

## The generalization beyond CI

**Prefer a bound the system declares over one you estimate.** Where a declared bound exists — workflow timeouts, `SLA`s, configured deadlines, documented API limits — read it. An estimated threshold encodes your guess about worst-case behaviour and silently rots as the system changes; a declared one is maintained by the thing it governs.

For agent turns, no equivalent declaration exists yet, so the estimate stands there — **but it must exceed the worst case, and an agent that fans out subagents has a worst-case measured in minutes** ([[project_8306_8785_triager_session_never_produced_a_turn]]: I judged a session dead at 60s when its first outbound came at ~3.5 min).

## Companion rule — newer evidence discharges its own claim, not its neighbours

Recorded here because it surfaced in the same exchange, twice in both directions:

- Refuting the *live-stall* claim on slang#8785 (it was latency) **does not** discharge the separate, still-unexplained **17-day** silence on #8306/#8785.
- Confirming the #12281 mtl flake **did not** rehabilitate the refuted *systemic-canceller* hypothesis that had been offered alongside it.

**Two claims arriving together stay independent. A refutation or confirmation lands on the claim it addresses, and quietly absorbing its neighbour is how a live problem gets closed by unrelated good news.**
