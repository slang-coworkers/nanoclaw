---
name: project_nanoclaw_1107_regression_quality_cohort
description: "slang-coworkers/nanoclaw#1107 regression-quality F07 producer fixes — reviewed inline at 31d960da, 2 latent 🟡 + 1 nit, non-blocking; candidate fix verified against the PR's own 27 tests; NOT merge-raced (6th in series broke the streak)"
metadata:
  node_type: memory
  type: project
  originSessionId: 5fec3d9a-41d7-403a-ba6e-6378ba6f1820
---

# nanoclaw#1107 — `scripts/regression-quality.py` fail-closed + cohort (szihs → `nv-main`, +679/−67, 2 files)

Direct follow-up to **[[project_nanoclaw_1078_regression_quality]]** — szihs's producer-side fixes for
the three 🔴 I found there. Opened 2026-08-06 12:59Z, head `31d960da`, CI **green** (ci 1m57s / check
11s / label 4s), `mergeStateStatus: CLEAN`. Reviewed **13:13Z (14 min after opening)**, still OPEN at
the same SHA ⇒ **not merge-raced** — the 5-instance streak (#1066/#1068/#1071/#1075/#1078) did NOT
continue. Comment [`5205080686`](https://github.com/slang-coworkers/nanoclaw/pull/1107#issuecomment-5205080686).

Routed **INLINE by Main** — 6th instance of the standing nanoclaw rule
([[project_nanoclaw_pr874_webhook_route_approver]]): webhook carried the generic post-#874
"route to `*-pr-approver`" string, overridden as usual (nanoclaw-platform fork, no nanoclaw approver
wired; a slang/slangpy *compiler* approver at a PR about the dashboard's metric producer is nonsensical).

## What it fixes (all three of my #1078 🔴, plus both 🟡)

`Collection` recorder → first fetch failure marks INCOMPLETE, metrics **withheld entirely** (not
zeroed), `complete: false` + `errors[]`, exit 1 · numerator re-cohorted to **culprit merge month**
(was issue-creation month vs. denominator's merge month) · `mixed` promoted to its own named class
with `cohort_mixed`, excluded from both rates · causal window now ends at the causal **block** ·
title + comment-fallback scanning · `merged_at < created_at` structured check · normalised bot logins
both sides · atomic write + `makedirs`.

**All claims reproduce.** `py_compile` RC=0 · 27/27 tests OK · live `slang-rhi --label bug` →
RC=**1**, `complete: false`, `errors: [{"what": "merged-prs"}]`, **no `cohort_bot`/`rate_*` keys**.
The `[[...]]` pagination bug it fixes **was** live (my #1078 finding that the `][` fallback is dead
code was about the *old* call path; here `Raw('[{"name":"other"}][{"name":"regression"}]')` proves the
splice now works).

## Findings — 2 🟡 + 1 nit, both LATENT, none blocking

1. 🟡**`causal_window` degenerates to the punctuation when a marker is followed by `:` — a REGRESSION
   vs. the old 240-char window.** `BLOCK_END.search(rest, lead + 1)` starts 1 char past the leading
   whitespace; with `Caused by:` → `rest=':\n\n- #12345\n'`, `lead=0`, search starts at offset 1 =
   **on** the `\n\n`, so `window=':'`. Measured old-vs-new on identical inputs: `Caused by:`+blank+list
   `[12345,12346]→[]`, `Root cause:`+blank+para `[12345]→[]`; `## Cause`+blank+para and `Since #a/#b`
   both still fine. ⭐⭐**`## Cause` passes only because the marker regex swallows the `#`s (lead=2 ⇒
   search_from=3 clears the boundary) — the passing test and the failing shape differ ONLY by whether
   punctuation sits between marker and newline, precisely the axis the 27 tests never vary.**
   **Severity LATENT: 0 of 85 real slang `regression` issues hit it** (0 markers followed by `:`).
   Candidate fix (skip `" \t:-—.)"` before measuring the block) **passes all 27 existing tests** —
   verified by patching a scratch copy and re-running.
2. 🟡**The cohort fix can move a regression out of the visible window entirely.** `months_shown` is
   now sliced from the **cohort** domain, so a recently-filed regression with an old culprit is counted
   in `cohort_bot` but rendered in **no row**: constructed (filed 2026-08, culprit merged 2024-06,
   `--months 12`, 24mo continuous volume) → `attributed=1`, `cohort_bot={'2024-06':1}`,
   `months_shown=2025-09…2026-08`, **sum of visible rates = 0**. Header says `attributed 1`, every
   visible row says `0` — same "indistinguishable from a real number" class, opposite direction.
   **Live severity NONE: across the 14 real (issue,culprit) pairs resolved against the API, max lag is
   1 MONTH** (7 at 1, 6 at 0), zero exceed 12. Widens as the repo accumulates history.
3. **Nit: `attributionFailed` (line 364) is structurally always 0.** Nonzero requires a `gh()`
   failure → `col.ok=False` → `publish(1)` at line 351, before 364 runs. Real value only via
   `partial.attributionFailed` (verified `{'issues':2,'unattributed':0,'attributionFailed':1}`,
   top-level key absent). A reader may read `0` as "lookups succeeded".

## ⛔ My own error, caught and self-corrected in the posted comment

**I read the live fail-closed run as exiting 0.** `python3 regression-quality.py … 2>&1 | tail -25;
echo "RC=$?"` — **`$?` was `tail`'s status, not the script's.** Re-ran without the pipe: TRUE_RC=**1**.
Had I published it, the headline finding would have been "fail-closed doesn't fail closed" against a
PR whose entire point is fail-closed — a false 🔴 on the author's central claim.
⇒ **[[feedback_never_read_an_exit_status_through_a_pipe]]** (existing rule, re-instantiated).

## ⭐⭐ What made both findings findable

Neither is visible by reading; both came from **differential execution against the pre-PR blob**
(`gh api …?ref=nv-main` → `base-rq.py`, same inputs through both). ⭐⭐⭐**For a PR that rewrites a
heuristic, the old version IS the oracle — a table of old-vs-new on the same inputs surfaces
introduced regressions that no amount of reading the new code will show, because the new code is
self-consistent.** Then **prevalence-check every finding against real data before assigning severity**:
both findings dropped from 🔴 to 🟡 on measurement (0/85 and max-lag-1-month), which is the difference
between a blocking review and an accurate one. Cf. [[project_nanoclaw_1078_regression_quality]]
(same instrument-not-prose family), [[feedback_control_the_instrument_not_the_reasoning]].

**RESUME** = szihs replies ⇒ offer the `causal_window` punctuation-skip patch (verified green against
his own suite) and the out-of-window-count guard. Both are LIVE on the branch; merge is the
maintainer's (`nv-main` outside the [[feedback_nv_coworkers_automerge]] grant, szihs-owned).
