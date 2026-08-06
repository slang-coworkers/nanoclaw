---
name: feedback_a_stale_snapshot_dispatch_duplicates_a_chain_another_leg_already_ran
description: "After a 429 + container restart, I resumed a 3h-old webhook and dispatched a scrub that a sibling leg had ALREADY completed and posted to GitHub — check the issue's own comment list for a bot footprint before dispatching a resumed chain"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5f902db6-b7bd-440a-86c2-16b225271efd
---

# A resumed chain is a STALE SNAPSHOT — re-read the issue before dispatching

2026-08-05, slangpy#274. Webhook landed 18:41. My turn died on a provider **429** (twice: 18:48, 19:08).
Container restarted 21:49 with "resume it — otherwise no response needed." I resumed from context and
dispatched a full `MODE=issue-scrub` to `slangpy-triager` at 21:56.

**A sibling leg had already done the scrub and posted the verdict to GitHub at 20:20** (comment
`5196896221`). My dispatch caused the triager to *re-derive* the whole thing and then **PATCH its own
prior comment** — the second scrub's real output was correcting the first scrub's inverted central claim.
Wasted a full triage cycle; got lucky that the peer patched instead of appending a duplicate.

## Why my context could not tell me

My session's inbound rows are **only** the webhook + the restart notice. The sibling leg ran in a
*different* session (thread `gh-issue-shader-slang/slangpy-820`, a 5-issue fan-out that folded #274 in as
one item). Nothing in my transcript referenced it. **A resumed chain's context is a snapshot from before
the gap, and the gap is exactly where other legs act.** ⭐ Three hours of provider outage is *precisely*
when a retry/redrive/sibling fan-out picks the work up.

## The check, and it is one command

```sh
gh api repos/<owner>/<repo>/issues/<N>/comments \
  --jq '.[] | "\(.user.login) @ \(.created_at)"'          # any *[bot] row after the triggering comment?
```

⇒ ⛔**Before dispatching a chain you resumed after any gap (429, restart, compaction), read the issue's
comment list and look for your own bot's footprint newer than the inbound you're acting on.** GitHub is
the shared state; my session is not. Per the MEMORY.md canonical-thread rule GitHub is the *primary*
observability surface — that cuts both ways: it's also where I can **observe myself** having already acted.

⭐⭐**The sibling-session detector generalizes the two-running-sessions rule** in MEMORY.md (which catches a
*phantom* duplicate on my own thread). This is the inverse: my thread was clean and correct
(`ncl sessions list | grep slangpy-274` → exactly one triager session), and the duplicate lived on
**another issue's** thread. ⇒ **Thread hygiene on my own key does not prove the work is unclaimed.**

## Also: the mis-threading that caused it (someone else's bug, worth naming)

The 19:42 leg dispatched the #274 scrub on `thread_id=gh-issue-shader-slang/slangpy-820` — a *different*
issue's canonical thread — bundling five scrubs into one session. That is the canonical-thread rule
violated in the "bundle" direction: per-issue chains collapsed onto one peer session, so #274's work is
invisible to anyone querying #274's thread. **A five-issue fan-out needs five `<message>` blocks with five
`thread_id`s**, which is exactly what MEMORY.md's fan-out rule says.

**How to apply:**
- ⛔**Resumed chain ⇒ re-read the GitHub artifact first, dispatch second.** Cost: one `gh api` call.
- ⛔**Never conclude "unclaimed" from your own session rows alone** — check the shared surface (GitHub),
  and if a bot comment exists, decide *correct vs. supplement*, not *redo*.
- ⭐When a peer reports "a prior bot comment already existed and its central claim was backwards", that is
  a **dispatch-duplication symptom**, not just a content error — trace which leg posted it.

Related: [[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]] (the `--full` aperture that
nearly hid the sibling leg from me), [[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]].
