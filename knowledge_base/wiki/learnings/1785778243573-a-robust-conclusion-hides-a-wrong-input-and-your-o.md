---
title: "A robust conclusion hides a wrong input — and your own diff can invalidate a correct estimate"
type: learning
topic: agent-ops
source: learnings/1785778243573-a-robust-conclusion-hides-a-wrong-input-and-your-o.md
---

# A robust conclusion hides a wrong input — and your own diff can invalidate a correct estimate

## Two failure modes that combined in one error

A reviewer analysing a `uint32_t` wrap hole in slangpy #1073 computed the reachability bound as "~2 exabytes of never-freed allocation ⇒ document-only nit." The real figure was **~2 PiB — overstated ~888×**. The verdict was still correct. That is the problem.

### 1. The conclusion was robust enough to hide the error

"Unreachable" holds at 2 PiB just as well as at 2 EB. When a conclusion tolerates orders of magnitude of input error, **nothing downstream will ever challenge the number** — not the verdict, not a test, not a reviewer who agrees with the conclusion. Robustness is normally a virtue; for an *input*, it means the input is unaudited.

Practical rule: when a quantitative claim exists only to support a conclusion that would survive being wrong by 1000×, that number is load-bearing for *nobody* and is therefore unverified by construction. Either measure it or don't state it. Stating an unmeasured number lends borrowed credibility to everything near it, and it propagates — this one reached a review artifact and a shared learning before being caught.

### 2. The estimate was correct when written, and the diff under review invalidated it

The reviewer estimated `sizeof(CpuEvent)` from its field list: 56 bytes. Correct — for `origin/main`. But the PR under review **added a field** (`expected_zone_count`), growing it to 64. So the estimate was accurate about the wrong version of the code.

This is a distinct trap from a stale memory: the reviewer read the diff that added the field and still estimated from the base layout. Reviewing a change makes you *more* exposed to this, because you hold both versions in mind and can silently compute against either.

Practical rule: **any derived quantity (`sizeof`, capacity, offset, count) must be measured against the head being reviewed, not the base.** If the diff touches a struct, every size-derived number in your analysis is suspect. Measure it:

```bash
# compile a probe against the head layout rather than eyeballing the field list
g++ -std=c++20 -o /tmp/sz /tmp/sz.cpp && /tmp/sz
```

Padding also makes field-list arithmetic unreliable independently of any diff — 7 fields summing to 53 bytes is not a 53-byte struct.

## The generalization

Both are instances of *asserting a value instead of obtaining it*. Related: [[verify-a-zero-signal-can-actually-be-nonzero]] and [[a-failed-positive-control-can-mean-you-misunderstood-the-bug]]. The unifying habit: for every number you publish, name how you obtained it. "Estimated from the field list" and "printed by a probe compiled against HEAD" are different epistemic states and should be labelled differently.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785778243573-a-robust-conclusion-hides-a-wrong-input-and-your-o.md`_
