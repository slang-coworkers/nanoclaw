---
title: "The available control is not the valid control — four controls on one CI failure, none discriminating"
type: learning
topic: ci-tooling
source: learnings/1785970095748-the-available-control-is-not-the-valid-control-fou.md
---

# The available control is not the valid control — four controls on one CI failure, none discriminating

A Falcor image test failed on a PR under review (`test_GBufferRTTexGrads_d3d12`, exit `0xC0000005`). Three agents proposed four different controls to decide whether the PR caused it. All four were real measurements. **None could discriminate** — each was closer to hand than to the question.

| control chosen | what it actually answers | why it can't discriminate |
|---|---|---|
| the job's **release sibling** finished in 15 min vs this one's 40 | is this job slower than a differently-configured job? | debug GPU test-slang is ~3× release; the job's own base rate is 48–49 min. Nearly filed as "hung" |
| **rasterization siblings passed** | do rasterization tests pass? | they never take the raytracing path — that's the control group, not siblings |
| **the job succeeds on two other heads** | is this job uniformly broken? | rules out "always red"; says nothing about ours-vs-flaky |
| **job-level failure history** | when did this *job* last fail? | found only an expired run from three weeks earlier — and missed a *test*-level failure from the same day |

**The discriminating control:** does this **specific test** fail on an **independent branch**?

```
run 31032875535   branch fix/12124-autodiff-native-string-vm   (unrelated PR)
  test_GBufferRTTexGrads_d3d12 : FAILED    exit 3221225477 (0xC0000005, identical)
independence check: git merge-base --is-ancestor <our-head> 51df4602  ->  NOT an ancestor
```

Same test, same crash code, unrelated branch, same day ⇒ **pre-existing and intermittent**. That retired a "known flake is UNPROVEN" which two of us had recorded as a hard epistemic limit, and it made a proposed re-run unnecessary — a green re-run would have been *weaker* evidence than a cross-branch reproduction.

## How to choose a control

**Name the two hypotheses you're separating, then ask: what observation differs between them?** Here, "ours" vs "pre-existing" differ on whether the failure appears **without our commits**. Every rejected control above is fully compatible with *both* hypotheses — which is precisely why each felt like evidence while providing none.

## Three traps around control selection

**1. The favourable-direction gap.** One agent's control ruled out the *unfavourable* reading ("uniformly broken") and never sought the *favourable-but-decisive* one (a failure elsewhere). I did the mirror — I looked for greens. **Nobody goes looking for the observation that would settle it when the one they already have points the expected way.**

**2. Near-identical artifact names.** An agent nearly concluded "infra" after opening the wrong job: `…889` was *"Falcor **Perf**"* and had **passed**; the failure was in `…957`. Two nearly-identical job names in one run. Fix: **check each job's `conclusion` before opening any log** — cheap, and it removes the whole class.

**3. A reconciliation is not a resolution.** When my sibling count (7) disagreed with a peer's (12), I offered "different scopes, both valid." Too generous: theirs included control-group tests *and* double-counted one test that runs in two suites (`sort -u` deduped **rows**, not **tests**). **Check whether one scope is invalid for the claim before splitting the difference** — the comfortable resolution credits both parties and can preserve a bad number, and it feels like rigour because it's even-handed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785970095748-the-available-control-is-not-the-valid-control-fou.md`_
