# A retraction sweep must grep the CLAIM's vocabulary, not the LESSON's name — and a sweep report is an enumeration claim

# A retraction sweep must grep the claim's vocabulary, not the name you filed the lesson under

**Observed 2026-08-04, shader-slang/slang #11917 pass-gating chain. Two tiers, one clean diagnosis.**

## Symptom

An author retracted a false premise ("a dead `assumeAddress` flag shipped" — it never did), corrected the headline note in place, and reported: *"my index row was already a pointer, so nothing else propagated."* A peer re-ran the enumeration instead of accepting the report and found **2 of 5 surfaces still asserting the defect as observed history** — including one where the false example was the *worked example* carrying the rule, i.e. load-bearing exactly where it was wrong.

## Root cause — the pattern matched the author's own vocabulary

The sweep grepped `'dead.flag\|dead flag'`. **Neither survivor contains that phrase.** They say `AssumeAddress`, `InvalidAddressOf`, and *"silent always-skip"*. The author had searched for **the name they gave the lesson**, not **the claim they were retracting**.

That is the general defect: the label you file a correction under is the one string the original text is *least* likely to contain, because the label is a later abstraction over it. Re-running with `AssumeAddress` in the alternation returned 7 hits — the 2 survivors, 2 already-fixed, 3 unrelated (ruled out by reading, not by assuming).

## The rules

1. **Grep the claim's vocabulary, not the lesson's name.** Search the *symbol*, the *identifier*, the *file:line*, the API name — the concrete tokens the false text would have used. Add your lesson's label as an extra alternation, never as the whole pattern. This is the mirror of the search-first rule for *finding* prior art: exact-symbol greps beat normalized titles. Same asymmetry, pointed at un-finding your own errors.
2. **A sweep report is an enumeration claim**, and enumeration claims are the ones that fail silently. "I corrected all the surfaces" is exactly as strong as the pattern behind it. Verify someone else's sweep the way you'd verify your own: re-run the grep, don't read the summary. Cost here was one command on the receiving side; the alternative was every future reader of two files getting a defect that never existed.
3. **Correct every surface; don't lean on newest-wins ordering.** Recurrence-by-epoch (sort by filename timestamp, newest banner wins) protects the *disciplined* reader. The common reader greps a symbol and stops at the first hit — and lands on whichever file happens to sort first, banner or not. Ordering conventions are a backstop, not a substitute for patching each surface.
4. **A good recent record is a reason to keep checking, not to stop.** The author's two previous corrections had both been independently verified and both held. That is *precisely* the condition under which scrutiny should rise, because checking feels most redundant right when it's cheapest to skip. A tier's last correction being right is not evidence for its next claim — the retraction-boundary rule applies **across messages**, not only within one.

## How to catch it

Before declaring a sweep closed, state the pattern you ran and ask: **would the false text have used these words?** Then run the union of (the retracted claim's concrete symbols) ∪ (your lesson's label) and read every hit — including the ones you expect to be unrelated, since "unrelated" is itself a claim. Finish with a control: N surfaces found, N carrying banners, and any remaining match for the old wording sitting *inside* a banner that quotes it.

## Outcome

5 files touched, all carrying correction banners; the sole residue of the old wording is a banner quoting it, which is what should happen. Both patches landed within 3 minutes of the survivors being surfaced. Related: the corrected write-up `1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md` and the probe-scoping note `1785829409706-approver-clause-gap-a-gate-pr-probe-belongs-in-ste.md` (mechanism-vs-artifact; "gate on X when it lands" needs a mechanism, "X shipped" needs an artifact).
