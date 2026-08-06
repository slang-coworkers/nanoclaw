---
name: feedback_a_branch_ref_is_not_a_commit_ref_after_merge
description: "Fetching a file by BRANCH name to establish what a PR changed measures the post-merge state and can make a real change read as a no-op — anchor to baseRefOid"
metadata:
  node_type: memory
  type: feedback
  originSessionId: pr1088-webhook
---

**MEASURED 2026-08-05 on slang-coworkers/nanoclaw#1088** (merge race: merged 7.5 min after opening,
mid-review — the norm on this repo).

To decide whether the PR was a real change, I censused `claude.ts` across all 7 fork branches with
`gh api .../contents/<path>?ref=<branch>` and found `SendMessage` **already** in
`SDK_DISALLOWED_TOOLS` on **every** branch — including the PR's own base. That reads as
*"this PR is a no-op, the fix is already everywhere."*

**It was wrong.** The batch (#1086–#1091) had merged *while I was reviewing*. `?ref=nv-dashboard`
resolves to the branch **tip**, which by then *contained the merge*. I was measuring my own PR's
effect and reporting it as the pre-existing baseline.

Re-anchored to the PR's actual `baseRefOid` (`gh pr view N --json baseRefOid` → `2e0041fb`,
blob `f00ed766`): `SendMessage` **in** `TOOL_ALLOWLIST`, **absent** from `SDK_DISALLOWED_TOOLS`,
neither list exported. Real change, correctly motivated.

⇒ ⭐⭐⭐**A branch ref is not a commit ref once a merge has landed. To establish what a PR CHANGED,
resolve `baseRefOid` / `headRefOid` and query by SHA — never by branch name.** On a repo where
merge races are the default posture, the window in which a branch name means what you assumed is
often shorter than the review.

**Why this one is nastier than a normal stale read:** it fails in the *reassuring* direction and it
is **self-consistent across 7 independent fetches**. Seven agreeing measurements feel like strong
evidence; they were seven instances of the same error. ⭐⭐**Agreement across N queries built from
the same defective key is not corroboration — it is one measurement repeated.** (Same shape as
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]: find the invocation / the pinned
commit, not the conveniently-named surface.)

⚠️**Direction matters for cost:** this error would have made me publish *"no-op, nothing to review"*
on a PR that did real work — i.e. it licenses **stopping**. Cf.
[[feedback_a_fact_that_lets_you_stop_investigating_is_load_bearing]].

**Cheap decisive check, run it verbatim:**
```
gh pr view <N> --repo <owner/repo> --json baseRefOid,headRefOid,state,mergedAt
gh api "repos/<owner/repo>/contents/<path>?ref=<baseRefOid>" --jq .sha
```
If `mergedAt` is non-null, **every** branch-name fetch you already did is suspect — re-run them.

Related: [[project_nanoclaw_1088_sendmessage_collision]] ·
[[feedback_four_states_where_the_decisive_check_feels_unnecessary]] (this landed in state 2, a
"confirmed-feeling prediction" — 7 branches agreeing *felt* like confirmation).
