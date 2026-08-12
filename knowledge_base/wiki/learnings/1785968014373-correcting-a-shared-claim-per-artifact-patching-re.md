---
title: "Correcting a shared claim: per-artifact patching relocates the divergence — sweep the set instead"
type: learning
topic: verification
source: learnings/1785968014373-correcting-a-shared-claim-per-artifact-patching-re.md
---

# Correcting a shared claim: per-artifact patching relocates the divergence — sweep the set instead

When the same claim is published on several GitHub artifacts (a child issue and its epic, a PR and the issue it closes), **correcting them one at a time cannot converge — each fix makes a sibling stale.**

Observed twice in one session (slangpy scrub, 2026-08-05). A crash localization was published on both issue #820 and epic #768:

1. Round one: retraction landed on **#768 only**. #820 — the one with the *live assignee*, and the one that said where to look — kept the wrong version for ~2.5h.
2. Round two: fixed **#820**. That made **#768** stale, because it still carried `[CUDAKernel] untested — "likely the same collision"`, which the very measurement that fixed #820 disproved. **Round one could not have caught this** — its whole framing was "the child is the neglected one."

**Why it's invisible:** *"Is this artifact current?"* is answerable locally, truthfully, and completely, while the set stays inconsistent. A well-formed question over the wrong domain. Completeness over the wrong set reads exactly like completeness.

**The fix — a claim → artifacts ledger.** Record every place a claim was published; when the claim moves, update every row in the same turn. The question is never "is this current?" but **"where else did I publish this?"** Machine-check it rather than recalling it:

```bash
for n in <all related issue numbers>; do
  gh api "repos/O/R/issues/$n/comments" \
    --jq '.[] | select(.user.login|test("my-bot")) |
          select(.body|test("<distinctive phrase from the claim>")) | .id'
done
```
Then confirm the **newest** bot comment on each hit is the correction. A stale claim *below* a correction is fine; the reverse is the bug.

**Two mechanics worth keeping:**

- **Post a new comment; don't add an Nth edit.** An amendment buried inside an already-amended comment gets scrolled past, and every PATCH risks the body — one nearly lost a 17k-char comment when a rate-limited read returned empty. Reserve in-place edits for text that is *wrong* and unreplied-to.
- **Retract the prediction, not merely the uncertainty.** "Untested — likely X" that turns out ¬X must say *the guess was refuted*, not *"now tested"*. Here the guess had **inflated a defect from one tag to both** (`[shader("compute")]` segfaults; `[CUDAKernel]` doesn't), so a reader who planned against both tags needed to know the scope halved. And when you narrow a claim, scope the narrowing too: that result was CUDA-only, so "doesn't crash" is unmeasured on the other three backends.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785968014373-correcting-a-shared-claim-per-artifact-patching-re.md`_
