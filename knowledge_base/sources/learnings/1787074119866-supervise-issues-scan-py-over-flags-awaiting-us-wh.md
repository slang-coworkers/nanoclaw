---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-18T17:28:39.866Z
---

# supervise-issues scan.py over-flags awaiting_us when ball==ours (skips park gate)

## Symptom
Tick 139 (2026-08-18, first run after scan scripts were modified 12:42 UTC) reported `summary.must_nudge: 119` — a 12× jump from tick 138's 10, with 113 `awaiting_us`. Firing 119 outward coworker nudges would have spammed maintainer-driving/human-debate chains and re-nudged already-nudged ones.

## Root cause (scan.py::classify)
The `ball == "ours"` branch (a non-bot spoke last) returns `awaiting_us` + `needs_nudge=True` **unconditionally** — it never consults the human-owned disposition or the PR-artifact gate. That gate (`we_owe_next_step` + `HUMAN_OWNED_DISPOSITION` token match) lives ONLY in the `ball == "human"` branch. So any chain explicitly dispositioned `advisory:maintainer-driving` / `active:human-debate` where a **maintainer** (a non-bot) spoke last escapes the park gate it was designed to hit. `test_scan.py::test_human_owned_disposition_stays_parked` only feeds **bot-last** inputs, so the gap is untested.

## The count inflates at FOUR independent layers (all must be filtered)
1. **45 rows** — human-owned disposition + maintainer-last (the scan bug above).
2. **34 rows** — already nudged ≥2× (skill Step 3 = escalate, not a 3rd nudge).
3. **11 rows** — true last actor is a review bot / CI (`coderabbitai`, `github-actions`) NOT in `bot_logins` (`{nv-slang-bot}` only) → reads as "human spoke last."
4. **~20 rows** — last "human" comment is an automated PR-board-sync notice ("do not reply") or an approval/LGTM under a human login — good news or bot-style post, not our ball.

Net: 119 → 9 substantive-human-turn candidates → **1 genuine owed action** (#7982: maintainer told @nv-slang-bot "please proceed", no PR, fixer stopped → nudged; the nudge woke a session that had been stopped mid-build by a container restart — exactly what nudges are for).

## Rule
When `must_nudge` jumps far above the recent baseline (0–10), DO NOT fire the firehose. Range-check first (absurdity beats agreement). Verify the ball direction live per candidate: drop park-dispositions, ≥2×-nudged (escalate instead), review-bot/CI-last, and automated-notice/approval-under-human-login. The `sent_nudges != must_nudge` invariant should be satisfied by **escalating the scan bug to the operator**, not by blindly sending 119 messages. Remediation to request: patch scan.py so `ball=="ours"` runs the same disposition/PR park gate as `ball=="human"`, and widen `bot_logins` to include `coderabbitai`/`github-actions` + skip automated-notice bodies.
