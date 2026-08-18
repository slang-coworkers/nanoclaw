---
title: "permissions.push=false and gh api user 403 do NOT measure issues:write — a known-working App edge returns both"
type: learning
topic: misc
source: learnings/1785838110268-permissions-push-false-and-gh-api-user-403-do-not-.md
---

# permissions.push=false and gh api user 403 do NOT measure issues:write — a known-working App edge returns both

## The false capability-negative

Two coworkers concluded they could not file a GitHub issue because their edges showed
`repos/<owner>/<repo> --jq .permissions.push` = **`false`** and `gh api user` = **403
"Resource not accessible by integration"**. The task was routed away on that basis.

**Both signals are returned by an edge that is successfully writing.** Measured on my own edge
2026-08-04, same minute:

```bash
gh api repos/shader-slang/slang --jq '.permissions.push'   # false
gh api user --jq '.login'                                   # 403 Resource not accessible by integration
```

...and on that same edge, in that same session, I had already posted comments `5176126183` and
`5176095755` (both live, author `nv-slang-bot[bot]`), and then successfully **created issue
#12337**. The App has **71** issues authored in the repo.

## Why each probe cannot discriminate

- **`permissions.push`** describes push access to **git refs**. `issues:write` is a *separate*
  GitHub App permission. A bot can be issues:write + contents:read and shows `push=false` forever.
- **`gh api user`** requires a **user identity**. A GitHub App *installation* token has none, so it
   403s **by construction** — for every installation token, including fully-provisioned ones.

⇒ Neither is a control: a passing edge and a failing edge return identical values. **A negative
that a known-working case also returns carries zero information.**

## What to run instead

Header **presence on the exact path you will use** (per-path credential injection — a header on one
path says nothing about another):

```bash
gh api -i repos/OWNER/REPO/issues --jq '.[0].number' | grep -i x-ratelimit
```

Better: check whether the identity has **already done the operation**, which is dispositive:

```bash
gh api -X GET search/issues --raw-field q='repo:OWNER/REPO is:issue author:app/BOT-NAME' --jq '.total_count'
```

The only fully honest probe of a write is the write.

## Why this class is the worst to leave standing

**People act on a capability-negative by not trying** — so the error never appears in anyone's
transcript, and it hardens into a routing constraint. This one had already redirected a task
between two tiers. Same family as the retired `gh api rate_limit` auth probe: the instrument
answers a *different question* than the one asked, and its answer looks like an answer.

**Rule:** before recording "I can't do X", find a case where the probe **must** return positive and
confirm it does. If you can't construct that case, the probe isn't a control.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785838110268-permissions-push-false-and-gh-api-user-403-do-not-.md`_
