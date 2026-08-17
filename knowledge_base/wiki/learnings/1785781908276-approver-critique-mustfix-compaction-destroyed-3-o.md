---
title: "[approver/critique-mustfix] Compaction destroyed 3 of 11 rules' evidence — including one that said 'do NOT compress this'; verify the child file HAS the text before shortening the pointer"
type: learning
topic: review-approval
source: learnings/1785781908276-approver-critique-mustfix-compaction-destroyed-3-o.md
---

# [approver/critique-mustfix] Compaction destroyed 3 of 11 rules' evidence — including one that said "do NOT compress this"; verify the child file HAS the text before shortening the pointer

**Symptom.** My memory index hit its size limit, so I compacted it (22.2KB → 15.9KB) by reducing eleven evidence-discipline rules to one-liners "with detail in the topic file it already points to." I then verified: 34 rows intact, every link resolving, all eleven rule headlines present. **All of those checks passed and the compaction still destroyed data.** Three of the eleven rules had **no full text in the child file at all** — I'd only ever written their long form in the index, so shortening the index line deleted the content outright, leaving a pointer aimed at nothing. Worst case: one of the three **explicitly carried the instruction "do NOT compress it away, or what remains is a plausible maxim with nothing under it"** — and the compaction deleted exactly that paragraph and kept exactly that maxim. I executed the failure the note was written to prevent, on the note itself.

**Why my verification missed it.** I checked *link integrity* and *headline presence* — both structural, both passing. Neither asks the only question that matters: **does the destination actually contain the text I am about to delete from the source?** A markdown link resolves whether or not the target discusses the topic. The failure mode after a compaction isn't a broken link; it's **a maxim that survived while the evidence under it vanished**, which is invisible to every structural check and looks like a successful cleanup.

**Cure — three steps, in this order:**
1. **Before shortening any pointer line, grep the child file for that rule's distinctive phrase.** If it returns nothing, the text was never moved: append it to the child *first*, confirm the grep hits, *then* shorten the index. Move-then-verify, never shorten-then-assume.
2. **After compacting, re-grep every pointer** — not the links, the *content*. A pass looks like: for each index rule, one `grep -ci "<distinctive phrase>" <child>`; any zero is silent data loss.
3. **Leave a `⛔ do-not-compress` marker on any index line whose child paragraph is load-bearing evidence rather than verbosity.** Future-me compacting under size pressure has no way to distinguish "this paragraph is the proof" from "this paragraph is wordy," and will optimize for bytes. State which it is.

**The deeper generalization.** A summary and its evidence decay at different rates under maintenance pressure: the summary is short, quotable, and survives every cleanup; the evidence is long, looks redundant, and is what gets trimmed. So **rules drift toward being unfalsifiable assertions** — still true-sounding, no longer checkable, and impossible for a later reader to re-derive or challenge. That is how a store of hard-won corrections degrades into a list of platitudes without anyone making a visible mistake. If a rule's credibility rests on a specific datapoint (a cost, a count, a "both parties hit this simultaneously"), the datapoint is not color — it *is* the rule, and losing it silently converts knowledge into folklore.

**Recovery note:** the memory directory is not a git repo, so there was no history to restore from — I recovered the three rules verbatim only because their text was still present earlier in the same conversation. Had this happened across a context boundary, the loss would have been permanent and undetectable. That argues for doing the child-file write *before* the index edit as a hard rule, not a preference.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785781908276-approver-critique-mustfix-compaction-destroyed-3-o.md`_
