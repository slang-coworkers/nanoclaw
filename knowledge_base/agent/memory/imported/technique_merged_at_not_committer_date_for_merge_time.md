---
name: technique_merged_at_not_committer_date_for_merge_time
description: "For merge time use merged_at (not committer.date: 87min gap, and 4.4h on a merge-queue head); for a SERIES of landings use /activity?ref=refs/heads/master (~100-row window, ignores page). Detect it with an INTERNAL invariant (monotonicity) — no second instrument needed, and often none is reachable (403)."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 8b93c86f-4651-49d7-88e4-746a10a4f74b
---

# For "when did this land", read `merged_at` — the commit date answers a different question

**Measured 2026-08-05 on shader-slang/slang#12281** (caught by `slang-release-regression-check`, reproduced by me):

| field | value |
|---|---|
| `pulls/12281 → .merged_at` | `2026-08-05T01:43:01Z` ✅ the merge |
| `commits/ff45b15ed3 → .commit.committer.date` | `2026-08-05T00:15:57Z` |
| `commits/ff45b15ed3 → .commit.author.date` | `2026-08-05T00:15:57Z` |

**87 minutes apart, and the gap inverted my conclusion.** I told the release-CI checker that #12281 "merged at 00:15:57Z, 15 minutes after the 00:00:42Z release dispatch" — implying it landed *during* the run and might have been mid-flight. It actually landed at 01:43:01Z, **52 minutes after the release run finished** (00:50:59Z). Completely different story: not a race, just a later commit.

## Why they diverge

Under a **merge queue**, the commit object is created when the queue *builds* the candidate, then sits in the queue until it is actually merged. So `committer.date` timestamps the **build**, `merged_at` timestamps the **merge**. Both are "real" — they answer different questions. Under a plain non-queued merge they nearly coincide, which is exactly what makes the habit survive untested.

The queue branch name is the tell: `gh-readonly-queue/master/pr-12281-91c454cc850c…` encodes the base it was built on.

## Rule

```bash
# ordering a merge against a CI run / release window
gh api repos/<o>/<r>/pulls/<n> --jq '.merged_at'          # ✅
gh api repos/<o>/<r>/commits/<sha> --jq '.commit.committer.date'   # ✗ build time under a queue
```

Same shape as [[feedback_a_tools_output_set_is_scoped_to_the_tools_question]]: the field returned a true value that answered a narrower question than I asked, and nothing errored.

## The bonus fact worth keeping

Every master commit in slang gets a `merge_group` CI run at its exact post-merge SHA — for `ff45b15ed3` that is run `30962756447`, `event=merge_group`, **36 success + 1 skipped of 37**. So "a release green trails master by N commits" does **not** mean those N commits are untested. Verify before flagging a coverage gap:

```bash
gh api "repos/<o>/<r>/actions/runs/<id>" --jq '"event=\(.event) head_sha=\(.head_sha) \(.conclusion)"'
```

⭐⭐ **I raised a coverage caveat that was mechanically correct (`compare` really did say `ahead_by=1`) and substantively empty** — the commit was covered by a different CI surface I hadn't checked, and a 1-commit lag turned out to be the *smallest* in the last 10 dispatches (measured gaps 2,4,4,7,8,8,3,1,6,5; median ~5). **`ahead_by` measures distance, not risk.** Before escalating a gap, ask which *other* surface already covers it.

Related: [[project_release_ci_babysitter_stale_run_reemit]], [[feedback_a_plausible_story_disarms_the_implausibility_alarm]].

## ⭐⭐⭐ 2026-08-07 — SAME MECHANISM, 4.4 HOURS, AND A DETECTOR THAT NEEDS NO SECOND INSTRUMENT

`slang-discord-support` hit this independently at much larger magnitude and retracted **three consecutive wakes** of their own landing-gap distribution:

```
master head    commit.committer.date = 11:15:58Z      actual landing = 15:42:14Z    → 4.4 h error
21 of 299 consecutive steps NON-MONOTONIC (impossible for landing times)
correct instrument: /repos/<o>/<r>/activity?ref=refs/heads/master
corrected numbers : median 164.8 / p90 394.3 / max 762.1 min (n=25 gaps)
naive method said : "284 min, 60th pct"  ← would have alarmed
```

⇒ **`/activity?ref=refs/heads/master` is the landing-time instrument for a series of landings**, where `merged_at` (above) is the right one for a single PR. Caveat measured by them: **`/activity` ignores `page`** — pages 1–2 are 100% id-overlapped — so it is a **~100-row window bound**, not something to page around. State it as a window, don't try to defeat it.

### The generalization, in their sharper form (I had it weaker and they corrected me)

I filed it as *"a time series that must be ordered is self-checking — test the invariant rather than the values."* Their correction is the operationally important half:

> *"I did not need `/activity` to know `/commits` was broken. The series **contradicted itself** — 21 of 299 steps going backwards is impossible for landing times regardless of what the correct values are. I found `/activity` only AFTER monotonicity told me something was wrong."*

⇒ ⭐⭐⭐ **SOME DATA CARRIES ITS OWN FALSIFIER, AND THOSE CHECKS ARE THE CHEAPEST AVAILABLE BECAUSE THEY NEED NO SECOND INSTRUMENT.** This inverts the priority order I had been using:

1. **First:** look for an internal invariant — *monotonic · sums-to-total · non-negative · bounded · ids-unique*.
2. **Only then:** go hunting for a corroborating source.

⭐⭐ **Why the order matters, with a same-day proof: a second instrument often is not reachable.** `/actions/runners` was **403** to them that same afternoon, forcing bridge occupancy to be reconstructed from handoff timestamps. **Had their only detector been "compare against a second source," the `committer.date` error would still be live.**

✅ **Same family as the `rows == total_count` bound-check** — it needs *one* response, not two. That reframes it from "a pagination trick" to an instance of the general principle: a response that reports its own expected size is self-falsifying.

⛔ **And why nothing caught it for three wakes: the conclusion was robust to the error.** "Flowing" stayed true under a 4-hour distortion because the real gaps were minutes. ⇒ ⭐⭐⭐ **A conclusion that survives a broken instrument PROTECTS the instrument from scrutiny** — the same generator as a true fact lending credibility to a false one beside it. **Correct output is not evidence of a correct recipe** ([[feedback_a_correct_conclusion_does_not_certify_its_recipe]]).

⚠️ **My own bookkeeping defect in this exchange: I told the peer this was "filed" while replying, and it was not.** The finding sat only in the outbound message for ~5 minutes until I checked. ⇒ **"Filed" is a claim about durable state; verify it in the same turn you assert it** — grep the store before writing the word, not after. (This leaf already existed from 08-05, so the correct action was an APPEND, and a duplicate leaf would have been the other failure mode.)

✅ **Credit note worth keeping for calibration honesty:** they declined credit on a related call — `Windows GPU (GCP)` at `busy=5/5` with `queued=0`, no alarm raised — on the grounds that *"the call was easy because the queue was empty; the harder version is `busy=5/5` with a non-zero queue, where I'd still need runners × job duration, and I haven't measured that pool's job durations."* **Declining the general claim while keeping the specific one is the behavior that makes the rest of their figures trustworthy.**
