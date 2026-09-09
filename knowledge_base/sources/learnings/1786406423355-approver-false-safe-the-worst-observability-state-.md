---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-11T00:00:23.355Z
---

# [approver/false-safe] The worst observability state is not "our finding is invisible" — it is "the visible claim points the other way", and on slang#12452 the public claim was the exact inference I retracted

## Symptom

I abstained on slang#12452 (`ABSTAIN_POLICY:OPEN_GAP`) partly because in-tree use
enumeration **cannot** establish public-header source compatibility — internal
linkage changes address identity for out-of-tree consumers I can't enumerate. I
recorded that as reversal #1 of my own WOULD_APPROVE.

The `github-actions[bot]` review posted **at my pinned head** carries this in its
reviewer sub-note (verified verbatim in my own harvest, `claude-review.md`):

> "All 15 uses of both constants across the tree are value reads … none take the
> address, so the internal-linkage change is **source- and ABI-compatible**."

That is the *same inference I retracted*, published on the PR as a settled
conclusion. With zero human reviews on the PR, it is the only public footprint.
My 🟡 gap is visible (it's in the posted findings table); my address-identity
measurement is not.

## Why this is a distinct and worse failure mode

The shadow-mode observability worry is usually framed as *"our decision leaves no
public trace"*. This is sharper: **the trace that exists argues the opposite of
the decision.** A maintainer reading the PR sees an authoritative-looking
"source- and ABI-compatible" and no counter-evidence. Silence would be neutral; a
confident wrong claim is not.

⭐⭐ **So the observability question to ask is not "did we leave a footprint?" but
"what does the footprint that exists say?"** Check the public state's *direction*,
not just its presence. If the visible claim contradicts your finding, the gap is
adversarial, not merely empty — and that difference should change how urgently the
finding gets surfaced through whatever channel legitimately owns posting.

## Corroborating detail: the published count is also wrong

The sub-note says **15 uses**. My script re-enumeration at the pinned commit found
**19 code uses** (+2 declarations, +5 comment mentions = 26 grep hits). So the
published claim under-counts the very population it generalizes from, which is a
second reason not to treat "none take the address" as settled — though note my own
count was wrong twice before I re-ran it, so this is a caution about the *class* of
claim, not a point against that reviewer specifically.

## Rule

1. **When your decision retracts an inference, check whether that inference is
   published anywhere.** A retraction that lives only in your local artifact
   leaves the refuted version as the public record.
2. **A bot review's sub-notes are conclusions, not evidence.** "Verified against
   [dcl.link]/7", "all N uses are value reads", "source- and ABI-compatible" are
   assertions whose scope you must check independently — repo-scoped enumeration
   cannot support a public-API compatibility claim no matter who states it.
3. **Route it; don't just record it.** I cannot post to GitHub (shadow-mode
   invariant, no credential, and the reviewer tier owns posting). The correct move
   is to make the mismatch legible to whoever *can* act — which is what happened
   here: the orchestrator put a COMMENT-state note to the operator with a
   recommendation and did not block on it. Recording the mismatch in my own notes
   would have left the wrong claim standing unchallenged.
