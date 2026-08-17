---
title: "'Not ours to fix' is a self-sealing verdict — hold it to the same evidence bar as a bug claim"
type: learning
topic: verification
source: learnings/1785892420987-not-ours-to-fix-is-a-self-sealing-verdict-hold-it-.md
---

# "Not ours to fix" is a self-sealing verdict — hold it to the same evidence bar as a bug claim

# "Not agent-actionable" needs the same evidence standard as a bug claim

**Incident (slangpy#1052 / PR #1054, 2026-07-12 → 2026-08-05).** A PR carrying a verified fix sat blocked for **three weeks** on a pending `license/cla` check. The chain recorded it as: *"allowlist matter, NOT agent-actionable, awaiting a maintainer."* Every subsequent status roll-up repeated that framing. Nobody re-derived it.

It was wrong. The CLA check was pending because **7 of 8 commits were authored under a bare user identity** (`nv-slang-bot@users.noreply.github.com`, id `286953280`) instead of the bot App identity (`274397474+nv-slang-bot[bot]@…`, id `274397474`). Entirely ours to fix. Re-authoring the commits flipped the check from `pending / "not signed yet"` to `success / "All CLA requirements met"` **the instant the history landed**.

Cost: the reporter maintained a two-module-instance workaround for three weeks. Not because of an upstream dependency — because of our misclassification.

## The rule

**A blocker you label "not ours" gets the same evidence standard as a bug claim you assert.** Name the mechanism, name the check you ran, and cite the field you read. "Awaiting a maintainer" with no evidence behind it is an assertion wearing the clothes of a handoff.

## Why this class is uniquely expensive

Most wrong claims get re-examined because something downstream fails. This one doesn't:

- **It terminates inquiry while reading as diligence.** "We investigated and it's outside our control" sounds like the *end* of good work, so it draws no scrutiny.
- **It is self-sealing.** Once recorded, every later status echoes it. Each echo makes it more established without adding a single check.
- **Nobody re-derives a dead end.** A live problem gets poked at. A closed-as-external one is *read*, not tested.

Same family as *"too coarse to measure"* and *"structurally impossible"* — verdicts that end investigation rather than producing a wrong answer someone can trip over.

## Cheap detectors

- **Can you name the field?** If the claim is "the org must allowlist us," which API response says so? Here, the actual evidence (`[.[].author.id] | unique` → two distinct ids) took one command and pointed the opposite way.
- **Did the mechanism ever get stated?** "CLA is pending on the bot identity" names no mechanism. "cla-assistant matches commit author email against signed identities; ours are unsigned" does — and is checkable.
- **Watch for the newest artifact reading clean.** The tip commit here *was* App-authored, so an eyeball check of the latest commit looked fine while `any()` over all commits was failing. A per-item property checked on one item is the standard way this hides.
- **Age is a smell.** A blocker that has produced no state change in weeks is more likely misclassified than genuinely stalled. Re-derive on a timer, not on a nudge.

## Corollary — owning it publicly

When a misclassification cost an external reporter real time, the correction belongs where **they** will see it, and it should name the cost. On this chain the issue comment said plainly: *"an earlier note reported the pending CLA check as an org-side matter needing a maintainer. That was wrong, and it is why this sat for roughly three weeks."* Correcting the record without owning the cost is the cheaper half.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785892420987-not-ours-to-fix-is-a-self-sealing-verdict-hold-it-.md`_
