---
name: feedback_rerun_partial_cancel_is_not_a_new_signature
description: "A `--failed` rerun that comes back `cancelled` after ~60s is NOT a new CI canceller. Diagnose via step conclusions + sibling start times: only the re-dispatched job restarts, siblings keep their original timestamps. `retry-on-gpu-failure` cancelling 5s AFTER the test job is a downstream victim (needs: predicate), not the actor. Actor field on a rerun = whoever pressed rerun."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-03
---

**Main-diagnosed 2026-08-03 22:5xZ, answering a babysitter ask on slang#12281 (run `30854197289`, job `91839632443`).**

## The situation that looked alarming

A `gh run rerun --failed` took (attempt 1→2), then attempt 2 returned **`cancelled`** — not pass, not fail. `Test Slang` was killed **62s in**, far too early for a 5746-test suite to reach the test under investigation. `retry-on-gpu-failure` was **also cancelled at the same head**. The babysitter flagged a possible **new signature: "cancel without re-dispatch"**, distinct from the benign `cancel-in-progress` class, and asked me to read the cancellation actor since GraphQL was 401.

## What the evidence actually shows — it is NOT a new canceller

**The decisive datapoint is sibling start times.** In the same run:

| job | started | conclusion |
|---|---|---|
| `test-macos-debug-clang-aarch64 / test-slang` | **22:47:53** | **cancelled** |
| `test-linux-debug-gcc-x86_64 / test-slang` | 21:44:59 | success |
| `test-linux-release-gcc-x86_64 / test-slang` | 21:49:40 | success |
| 32 others | ~21:2x–21:5x | success |

⇒ **only the re-dispatched job restarted at 22:47; every sibling kept its original ~21:45 timestamps and had already passed.** `--failed` re-runs *just* the failed jobs, so a run-level rollup of `34 success / 2 cancelled / 1 failure` is **one job's cancel plus retained history**, not a fleet-wide cancellation event.

**`retry-on-gpu-failure` is a victim, not the actor.** Main-verified timestamps: test job cancelled at **22:48:55**, `retry-on-gpu-failure` started **22:49:00 and cancelled 22:49:00** — it began *5 seconds after* the thing it supposedly cancelled, and `runner_name` is `null` (never dispatched). It is a `needs:`-dependent gate job; when its upstream is cancelled it is cancelled unstarted. **A job that starts after the cancellation cannot have caused it.**

## ✅ RESOLVED 08-04 00:0xZ — attempt 3 SUCCESS at the unchanged head ⇒ genuine flake. Plus a refinement to the actor rule.

**Main-verified:** `runs/30854197289/attempts/3` → `conclusion=success`, `head_sha=54f357b8` (**unchanged, no author push**), started 23:04:05Z. Green retry with zero code change ⇒ **`global-interface-param-compute.slang.3 (mtl)` is a genuine flake**, so the babysitter's original `intermittent` classification was right — it was the *systemic-canceller* hypothesis that was wrong, not the flake call. **One-off runner-reclaim verdict holds: zero cancelled macOS jobs across the other 74 heads**, bucket trigger stays disarmed.

⚠️ **Attribution correction (babysitter's own, and it matters):** `triggering_actor` on attempt 3 is **`pdeayton-nv`** — *a maintainer pressed it*. Not self-healing, and not the babysitter's rerun (its attempt 2 was the cancelled one). Good instinct to correct this before the record read better than reality.

⭐ **REFINEMENT to the actor rule — `actor` and `triggering_actor` diverge, and only one is useful.** Main measured all three attempts:

| attempt | conclusion | `actor` | `triggering_actor` |
|---|---|---|---|
| 1 | failure | `nv-slang-bot[bot]` | `nv-slang-bot[bot]` |
| 2 | cancelled | `nv-slang-bot[bot]` | `nv-slang-bot[bot]` |
| 3 | **success** | `nv-slang-bot[bot]` | **`pdeayton-nv`** |

⇒ **`actor` is pinned to the original run's initiator across every attempt; `triggering_actor` is per-attempt.** So `actor` cannot tell you who re-ran anything, and reading it that way silently attributes a maintainer's action to the bot (or vice versa). **Use `triggering_actor` on the specific `attempts/N`.** Neither field is the *cancellation* actor — that remains unavailable without the GraphQL timeline.

⚠️ **My "never the run-level rollup" was WRONG — babysitter corrected it, Main verified.** `runs/<id>` returns `run_attempt=3` **together with** `triggering_actor=pdeayton-nv` and `conclusion=success` — i.e. correct values *for the latest attempt*, and it **self-labels which attempt** via `run_attempt`. It isn't unreliable; it answers **a narrower question than the one you may be asking**. Right iff your question is about the latest attempt; silently wrong for any historical one (it would have reported attempt 2 as maintainer-triggered when the bot fired it). **Prefer `attempts/N` because it makes the attempt explicit, not because the rollup lies.**

⭐**The distinction is load-bearing and generalizes past this API: *"this field lies"* gets a field discarded permanently; *"this field answers a narrower question than mine"* keeps it usable with a stated scope.** Third instance tonight of the same error class — cf. `rate_limit`-as-a-liveness-probe (unavailable during the very outage it would diagnose, not wrong) and `triggering_actor` itself (reliable for "who dispatched attempt N" at every N; the trap was only ever asking it "who cancelled"). **Discarding a sound instrument for answering a question you didn't ask is its own defect**, and it's the mirror of over-correcting a claim — same reflex, applied to tools.

**`actor` on a rerun is not the canceller.** `runs/30854197289` reports `actor` / `triggering_actor` = **`nv-slang-bot[bot]`** — that is simply *whoever pressed rerun* (our own babysitter). ⚠️ **Do not read a rerun's actor field as the cancellation actor**; it answers a different question and reads as a smoking gun.

**No timeout, no superseding run.** Step conclusions show `Test Slang` ran 22:48:24→22:48:47 (23s) with no `timeout-minutes` expiry, and teardown steps 9-27 all **succeeded** afterward (clean orphan-process termination). `actions/runs?head_sha=…` → **0 newer CI runs** on `54f357b8`, so not `cancel-in-progress`.

⇒ **Most consistent reading: an infrastructure-level cancellation of a single macOS-aarch64 runner job** (runner reclaim / hosted-runner interruption), which is a known class on that pool — **not** a systemic canceller and **not** an untested-flake verdict. `#12281` is `mergeable_state=behind`, `auto_merge=null` ⇒ nothing stranded.

## The reusable diagnostic

When a rerun returns `cancelled`, before hypothesizing a canceller:
1. **Compare sibling `started_at`** — if siblings hold pre-rerun timestamps, only the re-dispatched job is in play. This alone kills most "fleet-wide cancel" theories.
2. **Read step conclusions**, not just the job conclusion — which step was cancelled, and did teardown succeed? Successful teardown after a cancelled test step = external kill, not a crash.
3. **Check `runner_name: null` + start-after-cancel** on any co-cancelled job ⇒ it is a `needs:` victim.
4. **`actions/runs?head_sha=<sha>`** for a superseding run ⇒ rules in/out `cancel-in-progress`.
5. **Never read a rerun's `actor`** as the cancellation actor.

⭐**The babysitter's judgment was right even though its hypothesis was wrong: it did NOT re-fire** despite cap allowing it (1/3), because *the cause was unidentified and blindly re-firing into an unknown canceller burns slots without evidence*. Correct — and note the asymmetry: **declining to act on an unexplained signal costs one sweep; acting on a misdiagnosis costs cap and credibility.** It also correctly refused to book the flake as cleared — `cancelled` is neither vindication nor refutation, and "I said I'd report either way, this is the neither case" is exactly the right framing.

Related: [[project_github_actions_graphql_401_outage]] (why the timeline was unreadable — GraphQL 401), [[project_bot_pr_priority_yield_red_run]] (the benign `wait-for-human-priority` class, **ruled out here** — that job *succeeded* this attempt).
