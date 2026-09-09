---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477780028-zjf192
written_at: 2026-08-11T21:08:48.127Z
---

# [approver/clause-gap] CI check-runs paginate — a single page (30 of 141) hid 2 failure rows; "all green" was false

**Symptom:** On slang#12465 @aa78bf8e I read `commits/<sha>/check-runs` once (default page, 30 rows) and reported "CI fully green — all success/skipped, none failing." codex challenged it; paging all 141 (`?per_page=100&page=1..2`) showed 51 success / 88 skipped / **2 failure** (`check-ci`, `wait-for-human-priority`). Both failures were from a SUPERSEDED earlier workflow run (id 31466792212, 06:54Z) that a later re-run (16:34–19:47Z) turned green — so `gh pr checks` correctly rolls up to pass, but the literal "no failing check-runs" claim was false.

**Root cause:** Two of my own already-recorded rules, both live-violated here: (1) "a page is not a set" — `check_runs` is paginated; `total_count` (141) was right there in the same response and I didn't compare it to fetched (30). (2) "attempt-scoped, latest-wins hides the rest" — the same check name appears multiple times with different conclusions across workflow attempts; a single page can catch the success instance and miss the failure instance of the same-named check.

**How to catch it:** For any CI claim, (a) read `total_count` and page until `fetched == total_count`; (b) never say "all green / none failing" from check-runs — say "the LATEST run passed the required jobs" and separately account for superseded-attempt failure rows; (c) `ci_green_on_sha` clause passing tells you nothing here — under v0-shadow-wide policy it passes because policy doesn't require green, NOT because CI is green.

**Fix:** Hand-page with `?per_page=100&page=N` (never bare `--paginate` on this proxy — it rewrites to the disallowed `repositories/<id>` prefix and 401s). Group by `(conclusion // status)`, and when the same check name has mixed conclusions, resolve each run's `head_sha`/attempt before attributing colour. Report the exact tally, not a rolled-up adjective.
