---
title: "Zombie queued CI runs poison queue metrics — 33% of a queue was two 71-day-old constants"
type: learning
topic: ci-tooling
source: learnings/1786134666479-zombie-queued-ci-runs-poison-queue-metrics-33-of-a.md
---

# Zombie queued CI runs poison queue metrics — 33% of a queue was two 71-day-old constants

`GET /repos/shader-slang/slang/actions/runs?status=queued&per_page=100` returned `total_count=6`. Two of those six were **zombies**:

- `26435273307` — "Falcor Tests", `event=pull_request`, branch `ci-coverage-renderer-cutover`, `created_at=2026-05-26T06:02:25Z`
- `26596502131` — "pages build and deployment", `event=dynamic`, master, `created_at=2026-05-28T19:13:08Z`

Both `status=queued`, `conclusion=null`, and `updated_at` never advanced past May (measured 2026-08-07, ages **73.6 d** and **71.0 d**). They are not queued in any real sense — they will never start or conclude.

**Why it matters:** that is **33% of the queue that is a permanent constant.** Any alarm computed from this endpoint is corrupted:

- *Queue depth* — a floor of 2 that never drains, so "depth ≥ 3" fires forever.
- *Max/median queue age* — max age was **105983 min** purely from a zombie. A median-age alarm is also skewed: with n=6, two pinned-at-infinity entries drag the median upward.

Excluding them, the live queue was 4 runs with max age 283 min — healthy.

**Generalizable rule (a sibling of "a constant mistaken for a measurement"):** before alarming on a count or a percentile from a queue endpoint, check that the population **varies** — specifically that each row's `updated_at` is recent relative to its `created_at`. A row whose `updated_at == created_at` and is days old is a stuck record, not a workload. Filter by age-since-`updated_at`, or simply drop rows older than some sanity bound, and **log how many you dropped** so the exclusion is visible rather than silent.

Detector that costs one line: sort `status=queued` by `created_at` ascending and look at the oldest — if it predates your alarm window by weeks, you have zombies and every aggregate over that endpoint needs re-deriving.

Corollary for the same repo: `event=dynamic` "pages build and deployment" runs carry a **lagged `head_sha` label** — two consecutive failures both reported sha `3241dfa8` while the newest master landing `7dc8091a` had zero pages rows matching its sha, despite a pages run firing 2 s after that landing. So **do not join pages runs to commits by `head_sha`**; use `created_at` adjacency. A sha-based join hid the fact that the last two landings both failed to publish.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786134666479-zombie-queued-ci-runs-poison-queue-metrics-33-of-a.md`_
