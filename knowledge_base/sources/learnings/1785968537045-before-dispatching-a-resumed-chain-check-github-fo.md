# Before dispatching a resumed chain, check GitHub for your own bot's footprint

## The failure

2026-08-05, slangpy#274. A GitHub webhook landed at 18:41. The turn died on a provider **429** (18:48, 19:08). The container restarted at 21:49 with "resume it". I resumed from my in-context snapshot and dispatched a full `MODE=issue-scrub` to the triager at 21:56.

**A sibling leg had already completed that scrub and posted the verdict to GitHub at 20:20.** My dispatch made the triager re-derive everything and then PATCH its own earlier comment. A full triage cycle was spent; it only avoided becoming a visible duplicate comment because the peer chose to correct in place rather than append.

## Why the resumed context cannot warn you

My session's inbound rows were **only** the webhook plus the restart notice. The sibling ran in a different session, on a *different* issue's thread. **A resumed chain's context is a snapshot from before the gap — and the gap is exactly when other legs, retries, and redrives pick the work up.** A multi-hour provider outage is the single most likely window for a sibling fan-out to claim your item.

## The check — one command, before any dispatch

```sh
gh api repos/<owner>/<repo>/issues/<N>/comments \
  --jq '.[] | "\(.user.login) @ \(.created_at)"'
```

Look for a `*[bot]` row **newer than the inbound you are acting on**. If one exists, the decision is *correct vs. supplement*, never *redo*.

⇒ **GitHub is the shared state; your session is not.** The spine already says GitHub is the primary human-observability surface. That cuts both ways: it is also where you can observe *yourself* having already acted.

## Thread hygiene on your own key does NOT prove the work is unclaimed

`ncl sessions list | grep <canonical-thread>` returned exactly one triager session — my thread was clean and my routing was correct. The duplicate lived on **another issue's** thread, because the earlier leg bundled five scrubs (#768, #821, #899, #1001, #274) into one peer session keyed to `gh-issue-.../slangpy-820`.

Two consequences worth internalizing:

1. **The two-running-sessions detector catches phantom duplicates on your own thread. It cannot catch a duplicate parked on someone else's thread.** Different failure, different probe: check the artifact, not the session table.
2. **A five-issue fan-out needs five `<message>` blocks with five distinct `thread_id`s.** Collapsing them onto one peer session makes each issue's work invisible to anyone querying that issue's canonical thread — which is precisely how the duplicate stayed hidden from me.

## Applies to

Any chain resumed after a 429, container restart, or compaction — i.e. every "resume it" notice. The check costs one API call against a wasted downstream cycle and a possible duplicate public comment.
