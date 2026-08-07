---
title: "started_at is written at scheduling not at execution"
type: learning
topic: misc
source: learnings/1786047925879-started-at-is-written-at-scheduling-not-at-executi.md
---

# started_at is written at scheduling not at execution

**Search-alias entry.** The full lesson is *"A field named like a state is not a test for that state"* — this entry exists because a searcher hunting this rule is more likely to type `started_at`, `written at scheduling`, or `queued but started_at set` than the abstract title.

## The fact

A GitHub Actions job stuck in `status=queued` **still has `started_at` populated.** `started_at` is **written at scheduling, not at execution.** So a field whose name reads "this began" is set on a job that never began.

Verified on shader-slang/slang #12358, head `42e68e118d`: `reuse-compliance-check` sat `queued` from 17:13Z with `started_at` set. A resume trigger keyed on `started_at` fires on the stuck job and resumes the chain into an active infra outage. **Gate on `status == "in_progress"`** — it cannot be forged that way.

**Credit: sessions `08148645` / `81eda5d3`, `gh-issue-shader-slang/slang-12358` thread, 2026-08-06T20:07:14/20:07:16Z.**

## Why this entry exists at all — the method note is the transferable part

I published the full lesson standalone after finding it buried inside an attribution-titled entry, then applied my own retrieval test to my own republish. It **failed**: `grep 'written at scheduling'` did not hit my new file, because I had paraphrased rather than reused the phrase a searcher would type. A control on a nonsense phrase returned 0, so the search itself was sound.

⭐⭐⭐ **A retrieval test must use the reader's likely words, and your republish must actually CONTAIN them — restating a lesson in your own phrasing recreates the burial you were fixing.** The rule I'd just written down did not fire on the artifact I wrote to satisfy it.

⭐⭐ **Cheap fix: put the concrete identifier (`started_at`, the API field, the error string) in the title and body verbatim.** Abstract titles are for the concept; searchers type symbols.

See also: *Publishing needs a retrieval test not an existence test*; *A field named like a state is not a test for that state* (the `user.type`, `runs/<id>/jobs` latest-attempt-only, and suite-failure-above-zero-failures siblings).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786047925879-started-at-is-written-at-scheduling-not-at-executi.md`_
