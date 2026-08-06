---
name: project_nanoclaw_1078_regression_quality
description: "slang-coworkers/nanoclaw#1078 regression-quality.py — MERGED 2.8min after opening (5th merge race); reviewed post-merge, blob == nv-main BY HASH; 3 red + 2 amber, all in the INSTRUMENT, none findable by reading"
metadata:
  node_type: memory
  type: project
  originSessionId: 32cbe725-a2bf-4dee-9cfd-93b392a46e0d
---

# nanoclaw#1078 — `scripts/regression-quality.py` (szihs → `nv-main`, +150/−0, 1 file)

**MERGED `d9688c8b` 2026-08-05 07:49:12Z, 168s (2.8 min) after opening.** CI green (ci/label/check).
Reviewed **post-merge**; reviewed head `842d6cd0` blob == `nv-main` blob `a8f8933cdd25` **BY HASH**
⇒ every finding is LIVE. Comment [`5189325006`](https://github.com/slang-coworkers/nanoclaw/pull/1078#issuecomment-5189325006).
Routed **INLINE by Main** — 5th instance of the standing nanoclaw rule (see
[[project_nanoclaw_pr874_webhook_route_approver]]); the webhook carried the generic post-#874
"route to `*-pr-approver`" string and it was overridden as usual.

**MERGE-RACE COUNT IS NOW FIVE** (#1066 −26s, #1068 +104s, #1071 mid-session, #1075 +8.5min,
#1078 +2.8min). Confirms the series rule in [[slang-nanoclaw-chains-index]]: post-merge is the
DEFAULT posture for szihs+`nv-main`; recheck state IMMEDIATELY before posting, verify blob by hash.

## What the script is

Third axis beside the Autonomy (bot PRs/wk) and Latency (issue→fix) charts: counts
`regression`-labelled issues, attributes each to a culprit PR via causal-language regex, classifies
bot vs human, reports **regressions per 100 merged PRs** per class. Not wired to any cron yet
(code search: 0 refs) — unlike `kb-health.py` / `kb-doctor.py`, and it needs network + `gh` auth
where those two are deliberately offline.

## Findings — 3 🔴 2 🟡, and NONE is findable by reading the file

⭐⭐⭐**All five came from RUNNING it** (stubbed `gh` fixtures + a real run against
`shader-slang/slang`), each probe paired with a control that could have returned the other answer.
Third consecutive PR in this series where the defects are in the INSTRUMENT and reading finds
nothing — cf. #1068, #1076. Same family as
[[feedback_control_the_instrument_not_the_reasoning]] and
[[feedback_a_guard_can_be_inert_and_read_as_passing]].

1. 🔴**Denominator silently empty ⇒ `per100` unmeasured, prints `-`, EXIT 0.** My real run
   reproduced the PR body's numerator EXACTLY (84 issues / 12 attributed / 14% / July 4 bot–4
   human) but **every rate column was `-` and botPRs/humanPRs were 0** — i.e. the body's headline
   `4.0 vs 3.2` did not reproduce. Cause: `gh()` gets `None` when the ~2.4 MB / 100+-page closed-PR
   walk is truncated mid-stream (401/rate-limit/network), then `or []` at line 123. `-` is an
   honest third state (better than kb-doctor's) but **exit 0 makes it unreadable to a caller**.
2. 🔴**A per-PR fetch failure is byte-identical to "not a culprit" and moves the headline.**
   `author()` → `(None, False)`; line 112 `if login and merged` drops it → counted `unattributed`.
   Stub, failing 1 of 3 PR fetches: coverage **100% → 75%**, July bot **3 → 2**, exit 0, no stderr.
   At n=4 a single transient 403 is −25% on the published number.
3. 🔴**Over-attribution introduced by the very fix that flipped the headline.** Body says both
   traps "UNDER-count" and widens the window to take EVERY ref; the over-count direction was never
   controlled. **7/10 probe cases mismatch, ALL false positives.** Bare `since` is the offender
   (temporal in English, and it fires on 8 of the 12 real attributions); also bare `bisect`, and
   `root cause` when the sentence names the FIX. Fix: anchor `since\s+#`, cut window at blank
   line/sentence end — both motivating cases still match (verified).
4. 🟡**Mixed bot+human ⇒ counted BOT, human culprit vanishes** (`any(...)` + `elif`), moving BOTH
   sides. Not a corner case: **#11859 is the only multi-culprit issue in real data and it IS mixed**
   (#11524 human + #11558 bot) — the body's own motivating example.
5. 🟡**Numerator/denominator are different cohorts** — issues by `created_at`, PRs by `merged_at`.
   **7 of 13 real culprits merged in a different month than the issue was filed.** `merged_at` is
   already fetched in `author()`, so bucketing by culprit merge month is free.

Smaller: `--months` slices last-N-months-**with-a-regression** not calendar months (sparse fixture
printed 2023-01/2024-06/2026-07) ⇒ a clean month is invisible, never shown as `0` · `#(\d{3,6})`
misses `#12`/`#99` (this repo is at 4 digits) · `dependabot[bot]` (1 real merged slang PR) absent
from `BOT_LOGINS` ⇒ counted human · label-fetch failure says "label not found".

## ⭐⭐⭐ Two of MY OWN reads were wrong; both corrected before posting

- ⛔**I read a `}{` in `gh --paginate` output as a PAGE SEAM. It was the OneCLI 401 error body.**
  Every `--paginate` call in this container fails (`app_not_connected`), so I was characterizing an
  error, not pagination. ⇒ **When your instrument is itself broken, its output tells you about the
  breakage, not the subject.** Caught only by asking what the bytes AFTER the seam said.
- ⛔**I claimed `gh --paginate` emits concatenated arrays needing the `][` fallback.** Settled it by
  standing up a **local 3-page TLS API** (auth-free, so the 401 couldn't confound): gh 2.96 emits
  **ONE merged array** — `[{n:1},{n:2},{n:3},{n:4},{n:5}]` — which `json.loads` parses directly.
  ⇒ the `][` fallback is **unreachable on the path it was written for**, and on a genuine
  concatenation returns `[[...]]` which raises at all 3 call sites. Also: all 5 `][` in a real
  2.4 MB PR list are **inside string content** (`int[0][2]`, `cb.m[3][1][2]`).
  ⭐⭐**A finding that contradicts the PR's own working numbers is probably about MY environment —
  that contradiction is the signal to build an auth-free probe rather than publish.**

⇒ ⭐⭐⭐**The general lesson: I nearly shipped "the fallback is load-bearing and broken" when the
truth is "the fallback is dead code". Both are findings, but only one is true, and the wrong one
would have sent szihs to fix a line that never executes.** Related:
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]],
[[technique_merged_at_not_committer_date_for_merge_time]] (same "measure the right surface" family).

## What holds up

Rate-not-count framing is right and load-bearing (38→101 bot PRs/month would make a raw count
decline-by-construction). Both motivating extraction traps are real and their fixes work. `--json`
carries full per-issue attribution. The "needs network unlike kb-health/kb-doctor" note is exact.
The body's own 14%-coverage caveat is the correct call, and the `## Cause` issue-template
recommendation is the highest-value item — it attacks the 86% no regex will reach.

**RESUME** = szihs replies ⇒ follow-up PR offered for exit codes (1+2), `since\s+#` anchor (3),
mixed bucket (4). Regressions are LIVE on `nv-main`, so this one is chaseable.
