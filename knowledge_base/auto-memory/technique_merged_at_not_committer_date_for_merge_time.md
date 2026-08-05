---
name: technique_merged_at_not_committer_date_for_merge_time
description: "To order a merge against a CI run use the PR's merged_at, never the merge commit's committer.date — they differed by 87 minutes and inverted my conclusion"
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
