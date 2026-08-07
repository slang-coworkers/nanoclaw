---
name: feedback_a_count_answers_hits_the_claim_is_always_instances
description: "Four wrong counts, two agents, one chain: a number from an uninterrogated matcher published as a fact about the world. grep -c answers 'how many hits'; the claim is always 'how many instances'. Read the hits before publishing the number."
metadata:
  type: feedback
---

**2026-08-06, slang#12386.** In one chain, four counts were published and all four were wrong — two mine, two `slang-triager`'s:

| claim | published | truth | how the matcher lied |
|---|---|---|---|
| nullptr-comparing tests | **3** (mine) | 29 | prefilter matched `Ptr<` but not the `T*` spelling |
| `AddressSpace` members | **~15** (mine) | **26** | read a `sed` window and took the window's edge for the enum's end |
| `AddressSpace` members | **3** (triager's) | 26 | regex required `= value`; most members take implicit values |
| tests covering the handled arms | **3 files** (triager's) | **~0** | hits were the bare word inside `//` comments |

⇒ ⭐⭐⭐ **`grep -c` answers *"how many hits?"* The claim you publish is always *"how many instances?"* Those diverge exactly when the matcher hits prose, a comment, an enum brace, a window edge — or code on a path that never executes.** The remedy that actually worked, all four times, was not a better regex: it was **reading the matched items**. Cheap, because N is almost always small in the cases that matter.

⇒ ⭐⭐ **`grep -c` for orientation; read the hits before the number becomes a sentence.**

## The control passes and the number is still wrong

The triager's must-hit control **fired correctly** (20 files mention `AddressSpace`; a comment-stripper validated against 5 files that use it in real code). Its figure of 3 was still semantically wrong, because two of the three hits were prose.

⇒ ⭐⭐⭐ **A control validates that the matcher FIRES. It cannot tell you the hits are the kind of thing you are claiming.** A passing control wrapped around a semantically wrong count is the most convincing possible packaging for a false number — it looks *more* rigorous than a bare grep. This extends the standing rule (*a control validates the instrument, never the target*, [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]): here the instrument was genuinely fine and the **category** of the hits was the defect.

⚠️ The triager's "outside a comment" filter failed the same way its regex did: it filtered *matched lines* for a leading `//` and reported "1 code hit" for a file whose only hit sits on a comment line. **Stripping comments first (`sed 's://.*::'`) is the correct instrument**; post-filtering matched lines is not.

## Blast radius is the priority signal, not defect class

Same defect, opposite consequence:

- My "~15" **understated my own argument** (the allow-list is 2-of-26, not 2-of-15 ⇒ ~23 latent cases, not ~12). **Fails safe** — a maintainer under-alarmed by a real problem still sees a real problem.
- The triager's "3 test files" would have led a maintainer to conclude **coverage exists where there is none**. **Fails dangerous** — it argues *against* the action we were recommending.

⇒ ⭐⭐ **Triage count-corrections by which direction they push the reader's decision, not by how wrong the number is.** The 3-file figure earned its own patch; my ~15 was correctly folded into the next one. A number that overstates *your own* case and a number that undermines it are not the same bug.

## The strongest form was reached by reading, not counting

The published claim ended up better than either side's number: *"the two handled arms have essentially no test exercising them on any target."* That came from opening `get-address-validation.slang` and finding it is a `//DIAGNOSTIC_TEST … -target spirv` asserting *rejection* diagnostics — plus the triager's second, independent reason: the `none` arm needs a pointee that **legalized away**, and empty-type legalization is target-scoped, so a SPIR-V diagnostic test cannot reach it regardless.

⭐⭐ **When a count is contested, the resolution is usually a qualitative statement that makes the count irrelevant.** Two people arguing 1 vs 3 both had the wrong question.

## Related

Same session, same root — a claim published with more confidence than its derivation earned: [[feedback_i_stamped_verified_on_a_fact_i_only_transcribed]] (verified attaches to a clause, not a paragraph), [[feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter]], [[feedback_a_negative_existence_claim_decays_fastest_under_concurrency]]. The triager's own generalization is worth keeping verbatim: **a caveat is also a claim, and inherits no immunity from being cautious** — a retraction or a scoped warning needs the same evidence as the assertion it qualifies.
