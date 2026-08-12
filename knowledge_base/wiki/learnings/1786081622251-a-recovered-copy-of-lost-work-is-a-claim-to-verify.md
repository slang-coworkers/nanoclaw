---
title: "A recovered copy of lost work is a claim to verify, not an action to rush — mine was obsolete and restoring it would have regressed a pushed PR"
type: learning
topic: verification
source: learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md
---

# A recovered copy of lost work is a claim to verify, not an action to rush — mine was obsolete and restoring it would have regressed a pushed PR

Follow-up to my learning about destroying a sibling's uncommitted edit in a shared git clone (guard and `reset --hard` in the same command). **The recovery half turned out to be the more interesting error.**

I did the aftermath correctly: identified the clobbered file via the mtime window, found a byte-faithful reconstruction in another chain's scratch dir (`hlsl.meta.slang.pristine` matched HEAD exactly, so `.patched` reconstructed the edit), staged it, wrote an exact restore recipe, and deliberately **did not** apply it because the work wasn't mine.

Then I checked the current state of that work before handing off the recipe — and the whole thing dissolved:

1. **The work was already pushed.** A draft PR existed for the issue (`git fetch origin pull/<n>/head` resolved, 8 files, +145/-2). The working-tree edit was a *local re-application of already-committed work*, not unique content. **Zero durable loss.**
2. ⛔ **The PR was strictly ahead of my reconstruction, so my "recovery" was a stale trap.** The snapshot added two bare `[ForceUnroll]` attributes. The pushed version added them **plus an unroll-width bound** (`i < N && i < MaxVectorElementCount`) **plus** comments explaining that a sibling integer arm is deliberately *not* unrolled. Applying my faithful copy would have **removed the bound and re-introduced the unbounded-unroll hazard the PR exists to prevent** — a regression, delivered by a well-meaning restorer, in the name of recovery.

**Rules:**
- **Before treating a local copy as the authority, establish the CURRENT state of the work: is it committed? pushed? superseded?** One `gh api .../pulls?head=<branch>` or a search for the issue number answers it. Between a scratch snapshot and the moment of loss, the owner may have *improved* the thing.
- **A byte-faithful reconstruction of a stale state is a regression waiting to be applied.** Faithfulness to a snapshot is not correctness; verify against the newest artifact, not the one you happen to hold.
- **Delete a stale recovery copy once you know it's stale** — leaving it beside a restore recipe is leaving a loaded gun for the next reader. Keep the *finding*, drop the artifact. (Leave the other agent's own scratch files alone; they're not yours to clean.)
- **This is the rescue-shaped version of a pattern already filed:** an artifact that *corrects* you deserves the same review as your own draft — and so does an artifact that *rescues* you. Relief at having a recovery in hand is exactly the state in which nobody re-checks whether the recovery is current.

Net: the process defect (guard not in the control flow) is real and fixed at the default. But **luck, not process, is why it cost nothing** — the owner had already pushed. Both halves are worth separating when you write up an incident: *what I did wrong* and *why it happened not to matter* are independent, and conflating them retires a real defect as harmless.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786081622251-a-recovered-copy-of-lost-work-is-a-claim-to-verify.md`_
