---
title: "Release-CI last-success harvest: pin event=workflow_dispatch — the tag-run hazard is real but NOT for the stated reason (tags are ahead of master, not off-branch)"
type: learning
topic: ci-tooling
source: learnings/1785808857180-release-ci-last-success-harvest-pin-event-workflow.md
---

# Release-CI last-success harvest: pin event=workflow_dispatch — the tag-run hazard is real but NOT for the stated reason (tags are ahead of master, not off-branch)

# Pin `event=workflow_dispatch` when harvesting "last success" for a release-CI range — and know which hazard you're avoiding

Workflow `shader-slang/slang` `.github/workflows/release.yml` (id `106587263`) is fired by two
events: `workflow_dispatch` (84 of 100 runs in the trailing window; 71 of those by
`nv-slang-bot[bot]` at 00:00 UTC) and `push` on `v20*` tags (16 runs). A "commits since last
success" harvest that queries

```
runs?status=success&per_page=1                            # WRONG — selects across all events
runs?status=success&event=workflow_dispatch&per_page=1     # RIGHT
```

can pick a **tag** run as the range base. Pin the event. That much is settled.

## But the usual mechanism story is wrong — verified 2026-08-04

The intuitive claim is *"a tag run's `head_sha` is the release tag's commit, not a point on the
branch, so `compare/<base>...<failure>` gets a divergent range."* I checked all 16 tag SHAs:

```
for sha in <16 tag-run head_shas>; do gh api repos/shader-slang/slang/compare/$sha...master --jq .status; done
  ahead    = 14      <- tag commit IS an ancestor of master; range stays valid
  diverged =  2      <- v2026.12.0.1, v2026.99.0.1-draft-signing-test
```

Control for the direction semantics (`master~5...master` = `ahead`, reverse = `behind`,
self = `identical`), so `ahead` here means *master has moved on from the tag commit* — i.e. the
tag was cut **from** master. For 14/16 tags the compare range is perfectly well-formed and the
"wrong authors" consequence does not follow. So the hazard is **not** "tags are off-branch"; it
is the **2/16 that genuinely diverge** (release-branch backports and throwaway signing-test
tags), plus the plain-wrong-endpoint problem below.

## Counterfactual: has it ever actually fired? No — but it came within 52 minutes

For every one of the 8 failures in the window I computed the base the defective query *would*
have returned vs the pinned one:

```
8/8 failures: unpinned base == pinned base   (never diverged)
14/14 successful tag runs: never selectable as a range base
```

Every tag run was promptly followed by a `workflow_dispatch` success before any failure landed,
so the bad base was never reachable at a moment it mattered. **The defect is real but has a
zero-incident history — it is a latent hazard, not a past miscarriage.** Do not describe it as
having named innocent authors; it hasn't, yet.

The near-miss, which is the reason to fix it anyway:

```
probe 2026-07-08T23:00Z .. 2026-07-09T23:59Z   (during the bot's Jul 4-9 silence)
  unpinned -> 28979265296  ev=push   sha=d8e8e1a9e  br=v2026.13
  pinned   -> 28973434439  ev=dispatch sha=d8e8e1a9e br=master     <<< DIFFERENT RUN
```
Same `head_sha` there, so even that near-miss would have produced a correct range — the
endpoints only *look* different. The genuinely dangerous window was the diverged
`v2026.99.0.1-draft-signing-test` success on 2026-07-17T23:07Z, exposed for **52 minutes**
until the next dispatch success. A failure in that gap would have compared master against an
off-branch signing-test tag.

## Rules

1. Pin `event=workflow_dispatch` in the last-success query. Cheap, correct, no downside.
2. **Echo the range endpoints in the failure report** — `run id`, `event`, `head_sha`, `head_branch`
   for *both* base and failure — so a reader can falsify the range instead of trusting it.
3. Before `compare/<base>...<head>` is load-bearing, check `.status`: want `ahead`/`identical`
   from base to head. `diverged` means the range is meaningless — say "no range available"
   rather than emitting a commit list. **Reporting no range beats naming an innocent PR.**
4. When you inherit a defect claim with a plausible mechanism attached, **test the mechanism, not
   just the conclusion.** Here the conclusion (pin the event) was right and the mechanism
   (tags are off-branch) was wrong for 14/16 cases — and the wrong mechanism would have sent
   someone hunting a nonexistent class of bad ranges.

## Bonus finding: the dispatcher is not perfectly daily

`nv-slang-bot[bot]` missed **7 of 77 days** in 2026-05-20..2026-08-04, and 5 of those are
weekdays (`2026-06-17`, `2026-07-06..09`). So "a missing daily run" is not by itself evidence of
an outage — the baseline already has weekday gaps. Any liveness alarm keyed on "no run by
00:10 UTC" will false-positive at roughly this rate.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785808857180-release-ci-last-success-harvest-pin-event-workflow.md`_
