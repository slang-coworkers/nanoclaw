---
title: "GitHub zeroes steps[] on jobs older than ~7 days — an nsteps==0 'untested' rule silently reclassifies aging failures"
type: learning
topic: misc
source: learnings/1786074037902-github-zeroes-steps-on-jobs-older-than-7-days-an-n.md
---

# GitHub zeroes steps[] on jobs older than ~7 days — an nsteps==0 "untested" rule silently reclassifies aging failures

**Measured 2026-08-07 on shader-slang/slang.** GitHub's `actions/jobs/<id>` endpoint returns `steps: []` (length 0) for jobs past the log-retention horizon (~7 days), even though `status=completed` and `conclusion=failure` are still correct and permanent.

Measured pairs (same query, same session):

| job | started | live `steps` length | log body |
|---|---|---|---|
| 91235888905 | 2026-07-31T18:21 | **0** | 151 bytes (HTTP 410) |
| 91273722579 | 2026-07-31T21:25 | **0** | 151 bytes |
| 91316359910 | 2026-08-01T02:43 | **0** | 151 bytes |
| 91597940205 | 2026-08-03T04:51 | 16 | 1.73 MB |
| 92726278414 | 2026-08-07T00:03 | 16 | 1.75 MB |

A snapshot I collected at 01:42 the same day stored `nsteps=16` for 91235888905 and `nsteps=15` for 91316359910 — so the zeroing happened **between my snapshot and my re-check**, not at execution time.

**Why this bites.** A common (and otherwise correct) triage rule is *"`conclusion=cancelled` with `steps==0` ⇒ the job never executed ⇒ UNTESTED, exclude from the denominator."* Applied to `failure` rows, or applied without an age guard, it silently reclassifies **real, executed, terminal failures** as untested once they cross the retention horizon. The bias is one-directional: it shrinks the failure numerator and the denominator, so a flake rate computed over a >7-day window drifts **downward** as the window ages — a health claim that improves by itself with no change in the fleet.

**How to apply.**
- `steps.length == 0` is only evidence of non-execution when the job is **inside** the retention window. Pair the check with an age test, or with the log body: a 151-byte log body is the HTTP 410 expired-log body and means "unreadable", never "no output".
- `status` / `conclusion` remain authoritative at any age. Bucket on those; use `steps` only as a secondary discriminator on fresh rows.
- If a stored snapshot disagrees with a live re-check on `steps`, suspect retention before suspecting your collector. `conclusion` disagreeing is the real anomaly (that means a job completed after your snapshot); `steps` disagreeing is expected for aging rows.

**Corollary for cached collections.** `steps` is a *perishable* field. Cache it if you need it, because you cannot re-fetch it later — but never re-derive an old classification from a fresh fetch and expect the same answer. Store the derived bucket alongside the raw row.

Related: the general rule that a defect biased toward inaction (here: toward "healthy") has a long half-life, because nothing downstream ever triggers an investigation.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786074037902-github-zeroes-steps-on-jobs-older-than-7-days-an-n.md`_
