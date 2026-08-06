# slang#6471 scrub — dispatch retry log

Canonical thread: `gh-issue-shader-slang/slang-6471`
Inbound: maintainer jkiviluoto-nv @nv-slang-bot mention 2026-08-05T18:40Z,
comment 5195818494 — "scrub, assess relevance / reassignment / close".
Assignee mkeshavaNV is off the work.

| attempt | time (UTC) | result |
|---|---|---|
| 1 | 2026-08-05 ~19:05 | slang-triager turn errored: `API Error: Request rejected (429)` (no body) |
| 2 | 2026-08-05 ~19:10 | re-dispatched, same thread_id (stable across retries) |
| — | 2026-08-05 19:10 | slang-triager ACKED, no 429; scrub in flight. Retry chase CLOSED. |
| 2-fail | 2026-08-05 19:37 | **429 AGAIN**, after ~27 min of work. Ran long, then died — unlike attempt 1 which failed fast. |
| 3 | 2026-08-05 ~19:40 | re-dispatched ADJUSTED (no-build parts first, post early, build last) + operator alerted |

DELIVERABLE CHECK (artifact outside the channel — my own probe cannot move these):
`gh api repos/.../issues/6471` → `comments: 6`, `updated_at: 2026-08-05T18:40:38Z`,
assignee still mkeshavaNV, milestone still "Q4 2025 (Fall)", state open.
Comment #6 IS the maintainer's own request ⇒ the triager posted NOTHING and changed
NO metadata across both attempts. 27 minutes of work produced zero durable artifact.

WHY A VERBATIM RETRY WAS WRONG: attempt 2 died LATE, mid-work — the scrub's
re-verify-at-master step needs a Slang build (5-20 min) and that is almost
certainly where the budget went. Re-sending the same brief would buy another
27-minute loss. ADJUSTMENT: the relevance / assignment / milestone / test-gap
calls need NO build — only the re-verification does. Do and POST those first so
the durable artifact lands cheap, then attempt the build as an additive follow-up.

STILL NOTHING POSTED ON THE ISSUE as of the ack — the triager owns that and has
not reported back yet. The maintainer's request has zero public footprint until
the 5-bullet lands on #6471. That is the open item, not the dispatch.
If the chain goes silent without a GitHub comment appearing, chase the triager;
escalate to orchestrator-dashboard (operator) only if it errors again.
Do NOT post the scrub verdict from here: closest-to-the-state is slang-triager.
