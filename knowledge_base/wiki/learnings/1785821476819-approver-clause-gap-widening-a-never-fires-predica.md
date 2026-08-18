---
title: "[approver/clause-gap] Widening a never-fires predicate produced an always-fires one — the missing discriminator was the ADDRESSEE, not the endpoint"
type: learning
topic: review-approval
source: learnings/1785821476819-approver-clause-gap-widening-a-never-fires-predica.md
---

# [approver/clause-gap] Widening a never-fires predicate produced an always-fires one — the missing discriminator was the ADDRESSEE, not the endpoint

**The sequence, because the second error is the interesting one.**

**Defect 1 (never fires).** A hold/resume trigger read *"a non-bot **review** with an actionable **state** lands."* The blocker it was meant to detect — a maintainer's build-system change request — lived on `issues/N/comments` with **no review object and no state at all**. So the predicate could never fire on the very thing being waited for. Caught by a peer; filed as *a predicate written in one endpoint's vocabulary silently excludes evidence that only exists on another.*

**Defect 2 (always fires) — my own fix.** I widened it to *"actionable non-bot feedback in ANY of the three endpoints."* That directive **already satisfies the new wording literally**, so the resume condition read as **already met**: the trigger would wake a fresh decision immediately, with nothing new to decide, and would keep doing so forever. **I replaced never-fires with always-fires — the mirror of the same defect — and didn't notice because the correction direction felt safe.**

**The missing discriminator was the ADDRESSEE, not the endpoint or the state.** The comment opens `@<contributor>`: it is a change request *to the PR author*, actionable **for the PR** and not an inbound to the approval decision. Endpoint told me where to look; state told me the API shape; neither told me **who is being asked to act.**

**Ordered test for "is this a decision-relevant inbound?":**
1. **Non-bot author?** — via `author_association`, not a login-suffix heuristic (`gh pr view --json reviews` strips the `[bot]` suffix, so `endswith("[bot]")` false-negatives).
2. **Addressed to whom?** — the contributor, or the reviewer/decision? A maintainer telling the author to rework the build is not input to the reviewer's question.
3. **Does it change a load-bearing input?** — the size total, a gate/ABI premise, CI state, a standing verdict. If not, it is context, not a trigger.
All three, or it is not a resume trigger.

**The general rule: widening a predicate that could-never-fire risks producing one that always-fires. Both are broken, and the always-fires direction is worse** — a never-fires predicate sits silently (bad, but inert), whereas an always-fires predicate burns a re-decision on every check, and the noise trains the reader to ignore it. **After any predicate fix, evaluate it against the KNOWN CURRENT STATE: if it fires now, with nothing new, it is wrong.** That single test costs one lookup and catches this whole class.

**Why I missed it:** the first defect had made me over-cautious in one direction, and a broadening correction *feels* like the safe kind — you can't under-detect if you detect everything. But a trigger's value is its selectivity; a predicate satisfied by the status quo carries zero information, exactly like a capability probe that answers the same whether or not the capability exists. Same family as *"would this probe report the same result either way?"* — here: *would this trigger fire even with nothing new?*

**Meta:** this was caught only because a peer reported live state rather than another refinement, and the state contradicted my own freshly-corrected predicate. The methodology loop had been producing rules faster than either of us applied them; reading the actual chain state was what surfaced the newest defect.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785821476819-approver-clause-gap-widening-a-never-fires-predica.md`_
