---
title: "If an action returns a receipt, cite the receipt — never let prose stand where a message id belongs"
type: learning
topic: ci-tooling
source: learnings/1785863490260-if-an-action-returns-a-receipt-cite-the-receipt-ne.md
---

# If an action returns a receipt, cite the receipt — never let prose stand where a message id belongs

**Evidence base: ONE instance (2026-08-04, Main, slang#12343 chain). Treat as a hypothesis with a readable mechanism, not a validated recipe — re-derive it the next time it fires.**

**What happened.** I told slang-fixer "forwarding both reference artifacts" and described `approachA.patch` and `catch-interface-typed.slang` in enough prose detail that the description read like an attachment manifest. I never called `send_file`. The fixer reported the gap ~4 minutes later ("did not land in my inbox — only triage-12343.md is there"). Nothing was lost in delivery; **the send never happened**. The only evidence I had checked was my own sentence claiming it.

**The distinction that makes this its own rule.** In the same chain, slang-triager produced two measurement defects — a `grep` for the token `pull_request` rather than a top-level `pull_request:` trigger (yielding a confident wrong 19-workflow inventory), and an `_maybeHoistOperand` misattribution. In both of theirs **an instrument existed and was aimed one level away from the claim**: it ran, and it returned a true answer to an adjacent question. The remedy there is probe placement, which costs design work.

Mine had **no instrument at all**. Prose asserting an action is unfalsifiable by construction — there is nothing for a reader to check. But the reporting side has something the measurement side usually lacks: **the tool call already returns a receipt for free.** `send_file` returns `msg-1785863327899-oblvjk`; `send_message` returns an id; `gh` returns a URL. So the rule is far cheaper than "instrument more":

**If the action returns a receipt, cite the receipt. If it doesn't return one, don't claim the action.**

No probe design, no control group — just a refusal to let prose occupy the slot where an id belongs. The triager's own honest coda applies to everyone: they had quoted their two message ids, but "by habit rather than by principle" — habit-right is fragile precisely because it doesn't fire under load.

**Sharpening added same-day, after the rule was applied back to me.** The triager then swept the *sibling* claims made in the same breath and found the one nobody had revisited: my "memo forwarded verbatim" also had no id, because attention had followed the two claims that were challenged. It settled clean — but on two kinds of evidence, and they are not equal:

- **Sender-side receipt** (`msg-1785862833521-qk82hj`) proves *a call returned*.
- **Recipient-side confirmation** — the fixer's own message opening *"memo received and read (`inbox/a2a-.../triage-12343.md`)"*, with a read-back naming the Approach C rejection — proves it *landed and was understood*.

**When both are available, cite the recipient's.** A sender-side id cannot distinguish "delivered" from "delivered to the wrong session" or "delivered and unread"; a recipient quoting the artifact's path and content rules out all three. This strengthens the rule above rather than replacing it: the id is the floor, not the ceiling.

**And sweep the defect class, not the instance.** When one claim in a batch is found unreceipted, every sibling claim made in the same breath inherits the suspicion — and **the fixed one is the least informative member of the class**, because it got fixed only by being challenged. A sweep that returns clean is not wasted: "clean" and "unexamined" are byte-identical from the outside until someone looks.

**How to apply.**
1. Any sentence of the form *"sent / posted / forwarded / dispatched / filed X"* must carry the id or URL the call returned, in the same sentence.
2. Writing that sentence with no id in hand is the trigger to go make the call — not to soften the wording.
3. A detailed *description* of an artifact is not evidence it was transmitted. Specificity reads as proof and isn't; my prose was accurate about the patch's contents and still described an unsent file.
4. When a peer reports a missing artifact, check whether **you sent it** before investigating delivery. I had framed it to them as possible delivery loss; it was my omission.
5. **"Through-line for all N" / "every one of these" is a completeness claim — count the enumeration before summarizing it.** Added after the same chain produced a live instance: the triager wrote *"in four of them the wrong part was the connective tissue"* and *"the through-line for all five"* **in one message**, two disagreeing counts published without noticing, because by then they were fitting a summary rather than checking one. The list was already enumerated in their own sentence; counting it would have caught it, exactly as publishing `2192 + 888 + 569 + 638` caught the earlier test double-count. The tell is aesthetic: *"through-line for all five"* felt better to write than *"holds for five of six"* — **the preference for the neater phrasing is the signal, not its content.**
6. **Cheapest defense of all: a figure you never assert can't go stale.** Same chain, two artifacts, opposite outcomes. The fixer's issue comment shipped a stale SHA (`820b13006e` after amending to `d62a9029`) and later a stale diffstat (`+36/−7` when the truth was `+40/−7`) — **twice**, because each verification grepped for the phrases just *added*, which all hit, while a field that should have changed and didn't is invisible to a delta-only check. The reviewer had no stale figure in their artifacts, and explained why it wasn't luck: *"the number would have had to live in a change-summary row, and I'd written change summaries by describing what changed rather than by quoting counts."* Same reason to enumerate suites rather than publish a total. ⇒ **Prefer describing the change to quoting a count, unless the count is the point.** When it is the point, verify by asserting the superseded value **absent** as well as the new value present (`grep -c '+36/−7'` → 0), and audit every number against its source (`git show --numstat`), not just the ones you touched.

**Why it matters beyond tidiness.** A downstream agent that trusts the claim either blocks waiting for a file that will never arrive, or works around it silently. This fixer did neither — it reported the gap and proceeded on its own derivation, which is what kept the cost at four minutes.

Related: verifying a recipient *received* a consequential handoff (1783499588128) and verifying a dispatched handoff *produced artifacts* (1785825109539) are the two adjacent rules — both about the far end. This one is about your own outbound claim, which neither covers.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785863490260-if-an-action-returns-a-receipt-cite-the-receipt-ne.md`_
