---
title: "Baseline before a value becomes a finding — and an inconsistency that partitions a search is invisible to the searches it partitions"
type: learning
topic: misc
source: learnings/1785973532983-baseline-before-a-value-becomes-a-finding-and-an-i.md
---

# Baseline before a value becomes a finding — and an inconsistency that partitions a search is invisible to the searches it partitions

Two closing lessons from a long PR review, both cheap to apply and both cost real time.

## 1. A finding manufactured from a normal value

I reported `mergeStateStatus` moving `BEHIND` → **`BLOCKED`** on an approved PR as "state drift" — twice, in messages to a peer. The **measurement was correct**: the value really did change. The error was treating a value as *informative* without ever establishing what values are ordinary.

One command across sibling PRs settles it:

```
#12322  draft=false  APPROVED         BLOCKED
#12336  draft=false  APPROVED         BLOCKED
#12301  draft=false  REVIEW_REQUIRED  BLOCKED
#12304  draft=false  REVIEW_REQUIRED  BLOCKED
ours    APPROVED · BLOCKED · mergeable=MERGEABLE · mergedAt=null
```

**`BLOCKED` is the resting state for every open non-draft in that repo, regardless of review status**, and `mergeable=MERGEABLE` sitting beside it is the tell that nothing is wrong. Calling it "drift" implies a change in *our* PR's health. A peer had already started digging through CI workflow files and branch-protection docs before running the control.

**Rule: before a value becomes a finding, ask "is this unusual *here*?" — not "what does this value mean in general?"** A cross-sectional control over sibling artifacts (other PRs, other jobs, other files in the same tree) is usually one command. **State names that sound alarming need it most** — `BLOCKED`, `FAILED`, `degraded`, `stale` — because the name does the persuading before the evidence does.

This is a distinct category from the more familiar "instrument answered a nearby question" failures: nothing was mis-measured here. It's also the exact inverse of discriminator work — there you ask whether a *failure* is normal; here whether a *state* is normal. Same missing step, opposite directions.

## 2. An inconsistency that partitions a search is invisible to the searches it partitions

Earlier in the same review, a peer and I agreed that a method declared `int` where every sibling was declared `SlangResult` was **"readability only — do not escalate."** That was correct about ABI (`SlangResult` is `typedef int32_t`; no vtable hazard) and **wrong about consequence.**

The `int`-spelled method turned out to carry the same latent defect as its siblings, and it was **missed by six successive audits** — because every enumeration filtered on methods spelled `SlangResult`. **The anomaly that had been catalogued as cosmetic was the thing hiding the defect from the person who catalogued it.**

⇒ **A "cosmetic" inconsistency that any enumeration filters on is not cosmetic — it partitions the search space.** That's a *correctness* argument for naming and typing consistency, not an aesthetic one.

**Same shape, different surface:** an audit of 145 CI check-runs appeared to show 30+ skipped required checks — a crisis. Cause: draft-era rows under **bare** names (`build-linux-debug-gcc-aarch64`) versus real jobs under **suffixed** names (`… / build`). Two naming conventions coexisting on one commit, so prefix-matching conflated *families* rather than merely mixing timestamps. Newest-row-per-name is insufficient when the naming convention itself changed — you need newest-row-per-name **within a family**, and the family boundary is invisible from a prefix.

**Practical takeaway:** when you notice a naming or typing inconsistency and decide it's harmless, ask one further question — *does any search, filter, or enumeration over this surface key on the thing that's inconsistent?* If yes, it is a standing blind spot for every future audit, and that outweighs the aesthetics.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785973532983-baseline-before-a-value-becomes-a-finding-and-an-i.md`_
