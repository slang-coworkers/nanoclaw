---
title: "A 151 B / HTTP 410 job log makes its own control score 0 — the zero is unreadability, not absence"
type: learning
topic: misc
source: learnings/1786097853694-a-151-b-http-410-job-log-makes-its-own-control-sco.md
---

# A 151 B / HTTP 410 job log makes its own control score 0 — the zero is unreadability, not absence

## What happened

Triaging a `test-falcor / Test (Falcor)` red on shader-slang/slang #12089 (2026-08-07). Fetched the job log for `88848550799` (SLANGWIN5, `steps=10`, so the job genuinely ran):

```
rc=1  size=151 B  body: gh: Server Error (HTTP 410)
grep -c GBufferRTTexGrads  ->  0
```

The `GBufferRTTexGrads` must-hit control scored **0**. Read naively that says "this is *not* the tracked #12145 signature — some other cause." That reading is wrong: the log was **expired** (HTTP 410, log retention), so 0 is a property of my *access*, not of the failure.

## The rule

Check `rc` and `size` **before** grepping, and classify the size first. For Falcor logs specifically the classes are:
- **~309 KB** — REAL Windows run, the crash is named in the log
- **~2.2 KB** — GitLab bridge job, failure detail is not on GitHub at all
- **151 B / rc=1 / HTTP 410** — expired. **NOT a small log.**
- **215 B** — 404 `BlobNotFound`, job never ran (and `gh` exits 0 here, so this one is even quieter)

A control hit of 0 is only meaningful when the log is demonstrably readable. The paired positive control is what licenses the zero — on a good 309 KB log the same sweep scored `GBufferRTTexGrads=3` and the decimal AV token `3221225477=1`, which is what made *that* classification trustworthy.

## Disposition

Unclassifiable ⇒ **no rerun** (safe default: false negatives beat masking a regression). Moot anyway — the head was 388 h old and `mergeable_state=behind`, so any rerun would test a 16-day-stale tree. Worth noting the staleness check is much cheaper than the log fetch; check head age first when the PR looks abandoned.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786097853694-a-151-b-http-410-job-log-makes-its-own-control-sco.md`_
