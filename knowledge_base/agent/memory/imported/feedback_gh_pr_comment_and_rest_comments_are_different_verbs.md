---
name: feedback_gh_pr_comment_and_rest_comments_are_different_verbs
description: "MEASURED 08-06 on slang-coworkers/nanoclaw: `gh pr comment` (GraphQL addComment) → 'Resource not accessible by integration', while REST POST /issues/<n>/comments SUCCEEDS on the same PR seconds later. Same intent, two verbs, opposite authority — a denial from one is NOT evidence the channel is closed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ae7da19e-8579-46f6-9860-2f27b4c38de3
---

# `gh pr comment` and REST `/issues/<n>/comments` are DIFFERENT VERBS with different authority

**Measured 2026-08-06, `slang-coworkers/nanoclaw#1125`, seconds apart, same token, same PR:**

```
gh pr comment 1125 --body-file …            → GraphQL: Resource not accessible by
                                              integration (addComment)          ✗
gh api repos/…/issues/1125/comments -X POST → id 5205656251, html_url …         ✓
```

`gh pr comment` goes through **GraphQL `addComment`**; the REST path is a different endpoint with
a different permission evaluation for this App. **One is denied, the other works.**

⇒ ⭐⭐**A write denial names a VERB, never "the channel".** I nearly recorded "comment posting is
now blocked on this repo too" — which would have been a published capability-negative with no
failure signature ([[feedback_published_negative_env_claims_need_rederivation]]): future readers
comply by *not attempting*, and nothing logs the loss. The correct next move after `addComment`
failed was **try the other verb**, which cost one call.

**This is the same family as the already-recorded fact one level down**, and extends it:
[[project_nanoclaw_1066_kb_fold_bounded]] measured `gh pr review --request-changes` →
`addPullRequestReview` denied while "plain issue-comment POST works". ⛔**What that note did not
say is WHICH comment path it meant** — and `gh pr comment`, the obvious reading of "plain issue
comment", is the one that FAILS. A note that records the working path only by intent, not by
endpoint, sends the next reader to the denied verb.

⇒ **Record write-authority facts as `<transport> <endpoint> → result`, never as a capability in
prose.** For this repo/app, verified:

| intent | invocation | result |
|---|---|---|
| review verdict | `gh pr review --request-changes` (GraphQL `addPullRequestReview`) | ✗ denied |
| comment | `gh pr comment` (GraphQL `addComment`) | ✗ denied |
| comment | `gh api repos/<o>/<r>/issues/<n>/comments -X POST` (REST) | ✅ works |

⚠️Perms/ratelimit look fully green in both cases (`{admin,maintain,push,triage}: true`,
`x-ratelimit-limit: 5000`) — **`permissions` is not evidence about which verbs an integration may
use**, and it is not evidence about which *transport* either.

## Recovery when the probe already posted (measured 08-06, #1129)

Diagnosing the GraphQL denial with a REST **probe** works — but a successful probe means
you have published `probe` to a human-visible PR. Do NOT post the real body as a second
comment and leave the probe: that is two comments where one belongs.

`PATCH /repos/<o>/<r>/issues/comments/<id>` edits it in place, so the probe becomes the
review and the comment count stays 1:

```
gh api repos/<o>/<r>/issues/comments/<id> -X PATCH -F body=@file.md --jq '.html_url'
```

Verify with `gh api repos/<o>/<r>/issues/1129/comments --jq '.[] | "\(.id) \(.body|length)"'`
— confirm ONE row and a length matching the real body (3,037 here), not the probe's 5.

⚠️ Use `-F body=@file` (or `--body-file`) for multi-line markdown; `-f body="$(cat f)"`
mangles it. And prefer a probe body that is not embarrassing if it survives a crash.
