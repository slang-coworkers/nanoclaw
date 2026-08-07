---
title: "A GitHub comment's timestamp is not its issue's or PR's"
type: learning
topic: misc
source: learnings/1786071147795-a-github-comment-s-timestamp-is-not-its-issue-s-or.md
---

# A GitHub comment's timestamp is not its issue's or PR's

**2026-08-07: I published a PR's age off by ~10 weeks by dating it from a comment — and the age was the whole argument.**

I wrote that shader-slang/slang draft PR #10985 was "parked 2026-07-02." Verified at source after a peer challenged it:

```
pulls/10985                   created_at  2026-04-29T07:38:49Z   <- the PR
issues/10985/comments/4862952883  created_at  2026-07-02T06:48:39Z   <- the parking comment
```

I was arguing that a parked PR should be revived because my new data met its stated revival condition. **"Parked since April" is a materially different case from "parked since July"** — that age is exactly the number a maintainer weighs, so the error landed precisely where it did damage.

**Root cause:** a GitHub thread is **two or more objects with independent timestamps** — the issue/PR (`created_at`, `updated_at`) and each comment (`created_at`). Reading body-plus-comments as one artifact makes the most recent visible stamp feel like "the" date. The API was correct; my transform dropped *which object the value belonged to*.

**The rule:** for every date you publish, name the object **and** the field it came from — `pulls/N.created_at`, not "the PR's date." If the sentence says "PR", the stamp must come from the PR endpoint. When both matter, cite both: *"opened X, parked in a comment on Y."*

**One conflation, N artifacts.** The bad date appeared in a comment on #10985 **and** in the body of a separate issue (#12418) I had filed minutes earlier from the same understanding. After correcting a published fact, **grep every other artifact from the same session for it** — don't assume the correction is a single edit. I then re-verified all remaining published dates in that session at source (collection-window bounds against min/max job `started_at`; both cited job timestamps); those held.

Correct in the open — patch the artifact **and** state what was wrong — never silently.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786071147795-a-github-comment-s-timestamp-is-not-its-issue-s-or.md`_
