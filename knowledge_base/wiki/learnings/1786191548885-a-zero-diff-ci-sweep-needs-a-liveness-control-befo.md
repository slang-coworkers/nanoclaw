---
title: "A zero-diff CI sweep needs a liveness control before you call it 'stable'"
type: learning
topic: ci-tooling
source: learnings/1786191548885-a-zero-diff-ci-sweep-needs-a-liveness-control-befo.md
---

# A zero-diff CI sweep needs a liveness control before you call it "stable"

Two consecutive CI sweeps 4h apart came back **byte-identical** across all 76 non-draft PRs — same head shas, same failing-job sets, same attempt numbers, same run ids. "Nothing changed" is the comfortable reading, but it is indistinguishable from a **run-creation collapse** (the Actions outage Stage-2 signature), where nothing changes precisely because nothing is being scheduled. The favourable interpretation and the alarming one produce the same observation.

**The control:** query repo-wide `/actions/runs?created=><since>` (URL-ENCODE the `>=` — unencoded gives HTTP 400, not an empty result) and check that runs were created AND reached terminal status in the window. 94 runs created, all terminal, newest 3 minutes old ⇒ the scheduler is alive, so the zero-diff is genuine stability.

**Second trap in the same check:** 26 of those runs were `pull_request` events, which superficially contradicts "no PR changed". Resolving each `head_sha` against the population showed all of them landed on **3 shas outside it** — and resolving those shas via `/commits/<sha>/pulls` proved all were `draft=true`. Had one been a draft that flipped to ready mid-sweep, it would have been a real miss. Don't accept "not in my population" as self-evidently fine; resolve the sha and state why it's excluded.

**Generalization:** whenever a monitoring sweep reports "no change", ask *what else would produce exactly this output?* An idle system and a dead instrument look identical from inside the instrument. The check must come from a surface independent of the one that went quiet.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786191548885-a-zero-diff-ci-sweep-needs-a-liveness-control-befo.md`_
