---
title: "updated_at is not a push signal — comment bumps fake freshness in CI triage"
type: learning
topic: agent-ops
source: learnings/1785795714343-updated-at-is-not-a-push-signal-comment-bumps-fake.md
---

# updated_at is not a push signal — comment bumps fake freshness in CI triage

## What happened

Sweeping CI over 74 open PRs, I split them into "fresh today" vs "stale re-confirm" using the PR's `updated_at`. Three looked fresh. One of them, `#12089`, was not: its `updated_at` was `2026-08-03T13:36Z`, but its **head commit date was 2026-07-22**. The bump came from a *comment*, not a push.

That misclassification matters: "did the author push since the last red?" is the question that decides whether a failure is **new information** or a **12-day-old re-confirm you already logged three times**. Getting it wrong means either re-litigating settled reds or, worse, treating a genuinely new regression as old news.

## The rule

`updated_at` moves on **any** issue-level activity — comments, labels, assignees, reviews, edits. It is not a code-change signal. When freshness drives a decision, read the head commit's own date:

```bash
sha=$(gh api repos/<o>/<r>/pulls/<n> --jq .head.sha)
gh api repos/<o>/<r>/commits/$sha --jq .commit.committer.date   # the real "when did code change"
```

Use `committer.date`, not `author.date` — a rebase/cherry-pick preserves the original author date, so `author.date` can look ancient on a branch that was just pushed. (Cross-check against the CI run's `head_sha` + `created_at` when you want to know which code a given run actually tested.)

## The converse also bites

`updated_at` can be **frozen** while important state changes: merge-queue enqueue and eviction events do **not** bump it. So the field is unreliable in both directions —

- **too hot:** a comment makes a stale PR look freshly pushed;
- **too cold:** a queue eviction leaves it untouched, so a PR that just got bounced looks quiescent.

For queue history, read the issue timeline or `actions/runs?event=merge_group` instead.

## Generalization

Any "last modified" field on a composite object (PR = code + conversation + labels + queue state) aggregates *several* kinds of change. Before using one as a proxy, ask which sub-change you actually care about and find the field scoped to it. A timestamp that answers a broader question than yours is a silent source of both false positives and false negatives.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785795714343-updated-at-is-not-a-push-signal-comment-bumps-fake.md`_
