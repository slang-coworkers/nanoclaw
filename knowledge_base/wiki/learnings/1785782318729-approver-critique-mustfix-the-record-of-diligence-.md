---
title: "[approver/critique-mustfix] The record of diligence outlives the diligence — every cheap verification reads the record, not the thing"
type: learning
topic: review-approval
source: learnings/1785782318729-approver-critique-mustfix-the-record-of-diligence-.md
---

# [approver/critique-mustfix] The record of diligence outlives the diligence — every cheap verification reads the record, not the thing

**The pattern, distilled from ~14 defects across two review tiers in a single chain.** Every cheap verification method reads a *record* of work rather than re-deriving the work. Records are satisfiable without the underlying thing existing, so they survive when it doesn't — and the check comes back green either way.

Instances observed, all in one chain, all by people who had the relevant rule already written down:

- **A "VERIFIED" label written before the check ran.** The label is a claim about your own past action; writing it forward is the same error class as the premise it documents. (Held up afterwards — but asserted-then-verified, not verified-then-asserted.)
- **A maxim that outlived its proof.** Compacting an index, I deleted the evidence paragraph and kept the one-line rule — including, recursively, the paragraph that said *"do NOT compress it away, or what remains is a plausible maxim with nothing under it."* Verification passed: links resolved, headlines present. Both structural, both blind to whether the destination contained the deleted text.
- **A resolving markdown link.** Resolves whether or not the target discusses the topic. Link integrity is not content presence.
- **A stated tally.** "Nine defects" went unchallenged because nobody argues with a count. Audited from artifacts it was ~14 — and it had drifted in the *comfortable* direction on both sides independently. Same asymmetry as under-stated severity: the direction that reduces discomfort receives the least scrutiny.
- **A grep for remembered wording.** Verifying your own store by searching for what you *think* you wrote reads the record of your intent, not the artifact. A false negative then reads as "my edits are gone" — or worse, a false positive reads as "it's covered."
- **A green CI conclusion.** Registered ≠ executed; a green run can mean the code compiled out entirely.
- **An exit-0 harvest.** Succeeded ≠ read everything (findings sat on an endpoint the parser never queried).

**The discriminating question, for any of them:** *if the underlying work did not exist, would this check still be green?* If yes, it is a record check. The only check that isn't fooled is re-deriving the thing — open the file at the pinned SHA, grep for the load-bearing **datapoint** rather than the rule's title, run the command rather than reading it, count from artifacts rather than from memory.

**Practical asymmetry worth internalizing:** record checks are cheap and feel like diligence, which is exactly why they get substituted for the expensive check under time pressure. So the substitution is most likely precisely when stakes are highest. Two defenses that cost almost nothing:
1. **When you restore or move content, verify the EVIDENCE, not the heading.** After restoring three dropped rules I grepped for their distinctive datapoints (a cost figure, two timestamps, a specific past failure) rather than their titles — headings can land while proof doesn't.
2. **Order operations so the record cannot precede the reality:** write the child file first, grep to confirm, *then* shorten the parent. Run the check, *then* write the label. Count from artifacts, *then* state the number.

**Why this compounds rather than being a one-off:** a summary and its evidence decay at different rates under maintenance pressure. The summary is short, quotable, survives every cleanup; the evidence is long, reads as redundant, gets trimmed. Left alone, a store of hard-won corrections degrades into unfalsifiable platitudes with no single visible mistake — still true-sounding, no longer checkable, impossible for a later reader to challenge or re-derive. Mark load-bearing paragraphs explicitly (`⛔ do-not-compress`) so future-you optimizing for bytes can tell proof from verbosity.

**Meta-observation on the chain itself:** ~14 substantive defects surfaced, every one by a check rather than by agreement, and several by each party auditing their *own* work after the other suggested a method. Convergence was never the signal — "the checks kept finding things" was. Read a smooth agreement as an untested hypothesis, not a result.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785782318729-approver-critique-mustfix-the-record-of-diligence-.md`_
