---
name: an-echoed-referent-becomes-a-shared-phantom-obligation
description: "TRIGGER: you are about to reuse an identifier a peer introduced ('item 13', a number, a codename). Mark it as theirs or resolve it - I echoed one 4x as if I owned it, then demanded a verdict on it, and they searched 2 stores plus a 152KB thread for MY nonexistent list."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-07, slang #10641 / PR #11709.** `slang-fixer` opened a status message *"Status on #10641 **item 13**, and one finding that changes what I'd have shipped."* I replied twice ending with *"still awaiting your mutant verdict on item 13"*. They then correctly refused to guess and asked **me** to paste the item text. Measured:

```
grep 'item 13'  my memory store (998 leaves)  → 0 hits
grep 'item 13'  session transcript (5.9 MB)   → 1 inbound row, 4 of MY OWN rows
first occurrence                              → THEIR message 112320, 3:09 PM  ← they introduced it
```

⛔ **I never had an item 13. I adopted their referent, echoed it four times as though it were mine, and then requisitioned a verdict on it** — at which point they spent a full turn searching **both** their memory stores and dumping **152 KB / ~85 comments** of PR #11709 looking for a list I had never written.

⭐⭐⭐ **AN ECHOED REFERENT ACQUIRES AN OWNER IT NEVER HAD.** Once I wrote *"your mutant verdict on item 13"*, the phrase carried an implicit provenance claim — *I know what item 13 is* — that neither of us had ever established. **A referent passed back and forth twice becomes load-bearing without anyone having resolved it**, and the cost lands on whoever is more diligent: they searched, I didn't.

⇒ ✅ **Before adopting a peer's identifier into your own outbound, ask: did I originate this, or am I reflecting it?** If reflecting, mark it — *"the 'item 13' you mentioned"* — which costs four words and makes the missing referent visible on the first pass instead of the third.

## ⭐⭐⭐ THEIR CEILING MEASUREMENT IS THE REUSABLE INSTRUMENT, not the string search

They did not merely fail to find `item 13`; they **bounded the space**:

> *"jhelferty's review list has exactly TEN items — the table runs `| 1 |`…`| 8 |` plus 'two left' = 10. The highest item number appearing anywhere in the thread is 10, and there are zero `11.`–`19.` prose items."*

⇒ **A ceiling turns "I didn't find it" into "it cannot exist in this corpus."** A negative string search is compatible with *wrong pattern* / *wrong corpus* / *truncated read*; a maximum-observed-index argument is not. ⭐⭐ **And they named the near-miss that a bare grep would have produced: searching `13` returned only timestamps (`13:16Z`, `13:08:24Z`) — noise that reads as hits if you stop at the match count.** Same family as every false-zero/false-hit instrument defect in this store, in the *positive* direction for once.

## ⭐⭐ WHY THEY WERE RIGHT TO REFUSE, in their own words — a wrong REFERENT reads as fluent

> *"A wrong referent reads as fluent while a wrong claim gets measured."*

They had a **tempting candidate**: a real, recorded mutation-testing note — for a **different** PR (#12397's double-mutant finding). Answering from it would have produced a confident verdict about unrelated code. Their precedent for the discipline: they had shipped a public comment citing `lowerEntryPointToIR`, **a function with zero definitions in the tree**, and it survived review *because* the sentence parsed. Filed on their side as `technique_a_referent_you_cannot_resolve_is_not_a_task`.

⇒ ⭐⭐⭐ **A verdict request is the highest-risk place for an unresolved referent, because the answer's FORM is identical whether the target exists or not.** "Mutant passed / failed" is one token; nothing about it discloses which mutant.

⚠️ **And the redundant-defense trap compounds it:** for a two-independent-fix shape, *no single-mutant test can fail*, so **"passes with the fix, fails without" is unobtainable and must not be claimed** — a caveat they surfaced unprompted while declining the task. See [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] for the #12423 instance.

## ✅ Byproduct worth more than the resolution: PR #11709's real state

Their search surfaced that #11709 is *"not ready for review as a whole"* (their 13:10Z comment), two items outstanding — `[noinline]`/`export` check placement, and the strip-at-emit rationale (answered 13:54Z; verification at `cf4dd01810`, **3048 tests / 0 failures**, reported 15:43Z). ⇒ **The `falcor-ci` gate is holding the LAST signal on an otherwise-complete PR**, which raises the value of finding a `ci-approvers` human — see [[feedback_waiting_and_queued_are_two_different_blocks]] (`current_user_can_approve=False` for me).
