---
title: "A bare-token bucket regex inflated a flake ranking 8.5×; and check subset/superset before ranking buckets side by side"
type: learning
topic: ci-tooling
source: learnings/1786206669441-a-bare-token-bucket-regex-inflated-a-flake-ranking.md
---

# A bare-token bucket regex inflated a flake ranking 8.5×; and check subset/superset before ranking buckets side by side

Measured 2026-08-08 auditing my own 7-day rerun ranking after a parent challenge.
**Three independent defects, all in the same ranked list, all pushing the same way.**

**1. A bare token in a bucket regex matches PROSE, not signal.** My `runner-lost` bucket
used `lost communication|shutdown signal|runner`. That trailing bare `runner` matched rows
saying "runner SLANGWIN5", "passes on another runner", "no runner" — rows that NAME A HOST
while diagnosing something else. Result: **17 reported = 2 real + 15 artifact (8.5× inflation)**,
which vaulted an infra class to #1 and became the basis of a recommendation. One of the 15 was
a `DXGI_ERROR_DEVICE_REMOVED` row that belonged in a GPU bucket.
⇒ Every bucket term must be a signature that cannot appear in ordinary diagnostic prose.
Audit by printing the ±45 chars around each match for the rows a bucket claims — the artifact
is instantly visible and invisible to a count.

**2. Ranking a SUBSET beside its SUPERSET.** I listed "falcor 10" and
"GBufferRTTexGrads 8" as competing buckets. `GBufferRTTexGrads` **is a Falcor test** — 7 of
its 8 events were *also* falcor events. Not two buckets; one bucket and a member of it.
⇒ Before ranking, compute pairwise overlap. If bucket A ⊂ bucket B, they cannot be peers.
Tell: multi-label sum (25) ≠ event count (42) means labels overlap — print both.

**3. 64% of events matched NO bucket — and the biggest cluster hid there.** 27 of 42 real
reruns were unbucketed, and the largest cluster inside them was the `#12341` SLANGWIN5
spirv-val defect (`compile 866/866` vs `spirv-val 0/866`, exit 255) on 6 PRs. My ranked list
never showed it. **It was also disqualified**: #12341 closed 08-05, and the post-fix window
shows 9 fires all-time but only **1 after the close** (36 min later, in-flight) and **0 in the
2.7 days since**. So the true top cluster was a fixed issue.
⇒ Always report the unbucketed share. A ranking that leaves the majority unclassified ranks
your regex, not the repo.

**Why it mattered:** all three errors flowed toward recommending a *quarantine* (delete a
test's coverage) rather than a *nudge to the owner*. The parent caught it because my own
numbers contradicted my own prose — "dominant driver" for a bucket ranked #3.

**Bonus limit — a rerun ledger cannot support a signal-to-noise claim.** Justifying a
quarantine needs "N true positives vs M false ones," but a rerun log records only MY
decisions; a real failure that correctly blocked a PR never becomes a rerun row. The
true-positive count is structurally absent. Quarantine advice needs an independent basis.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786206669441-a-bare-token-bucket-regex-inflated-a-flake-ranking.md`_
