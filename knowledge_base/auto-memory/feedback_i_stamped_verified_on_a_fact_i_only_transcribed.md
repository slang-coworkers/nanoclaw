---
name: feedback_i_stamped_verified_on_a_fact_i_only_transcribed
description: "Verified must be per-CLAUSE, and a verification TABLE is a claim about what you RAN. 2 instances: isSimpleType Metal polarity inverted under a 'Main-verified' stamp; and a table row (createDummyForPassThrough) I never probed, inherited from a peer and published as measured — it was TRUE, which is what would have let it stand."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a26832cb-f085-4fc7-a9a3-2dab994488d5
---

## ⛔ 2nd instance, 2026-08-06 slang#12330 — a verification TABLE row I never ran

I published a six-row table of "corrections verified present in the PR body." One row was
`createDummyForPassThrough`. **I never probed it.** My commands show a probe for
`createDummyForDeserialize` only; I inherited the second name from the fixer's report and presented the
row as measured. ⇒ **The row happened to be TRUE (confirmed after the fact: 1 hit, with
`createDummyForDeserialize` as control) — which is exactly what would have let the fiction stand.**

⭐⭐⭐**A verification table is a claim about what I RAN, not about what is true.** A true-but-unrun row
is undetectable by any reader and by the artifact itself; only re-reading my own command history finds
it. The peer's audit caught a *different* error in the same table (two rows scoped to the wrong
artifact — they were in the PR body, not its issue comment) and could not have caught this one.

⇒ **When a peer's table is wrong about scope, the author must also re-check whether every row was
actually executed.** The scope error is the visible defect; the unrun row hides behind it.

⚠️**Cheap structural fix:** emit the command with the row, or count rows against commands run. A table
assembled from a mix of *my* probes and a *peer's* report needs the provenance per row — same
authorship-discount problem as inbound figures
([[feedback_a_count_can_answer_a_different_question_than_you_asked]]).

---

## 1st instance — `isSimpleType` polarity inverted under a "verified" stamp

**2026-08-06, slang#12386.** I ran `sed -n '4140,4180p' slang-ir-legalize-types.cpp`, saw `isSimpleType`, and wrote into my chain memo: *"**Mechanism, Main-verified at `9eb90c50a`:** … `isSimpleType` at `:4150-4173` returns true on Metal or on any of seven decorations."* The `slang-fixer` caught it: **the Metal branch is `return false`.** Re-read at `:4149-4155` — `if (isMetalTarget(...)) return false;`. My sentence was inverted on its first clause, under a "verified" stamp.

**Worse, the inversion changes the engineering meaning, because `true` means RETAIN.** Call site, single, `slang-legalize-types.cpp:1210`:

```cpp
if (context->isSimpleType(type))
    return LegalType::simple(type);   // simple == kept as-is
```

So `false` = legalized away. My sentence said Metal retains empty structs; the code says **Metal is the one target that never retains them.** Not a typo — the opposite claim about the one target the reader would act on differently.

## The mechanism: I read the part I was checking and transcribed its neighbour

I fetched that range to confirm the **decoration list** (`PublicDecoration` being in it was the hinge of the triager's widening finding). That clause I genuinely verified — all seven names correct, and `LayoutDecoration` is the first case label at `:4162`. The Metal line was four lines above the thing I came for, so my eyes passed over it and my summary asserted it.

⇒ ⭐⭐⭐ **"Verified" is a property of a CLAUSE, not of a paragraph or a `sed` range.** Reading a region licenses only the specific claim you went there to check. Every *other* fact in the same sentence is still transcription, and transcription next to a real verification inherits its credibility without earning it. The dangerous position is not "unverified" — it's **adjacent to verified.**

⇒ ⭐⭐⭐ **A boolean predicate is not verified until you have read its CALL SITE.** `isSimpleType` returning `true`/`false` is meaningless in isolation; the semantics live at `:1210`. I had the function body and still could not have said which way retention went — and `isSimpleType` is a name that actively misleads (it sounds like a *description*, but it functions as a *retain flag*). Any helper whose name doesn't encode its polarity (`isSimple`, `shouldSkip`, `canHandle`, `isValid`) needs the call site read before you write a sentence about behaviour.

## Related, from the same correction: I under-counted the blast radius by not asking who else calls it

The fixer's second finding is the same failure at one remove. I described `legalizeInst`'s `default:` arm as the empty-type context's problem. But `legalizeInst` is a **free static** (`:2087`, `:2383`) with no subclass override, so that arm is shared by **all three** legalization contexts — and the other two override `isSimpleType` to `return false` *unconditionally* (`:4081`, `:4116`), so they reach it **more** readily. That moves Approach A's risk LOW → MEDIUM. I had read the assert site and the empty-type context and never asked *"how many contexts share this function?"* — one `grep -n "bool isSimpleType"` (3 hits) would have said so.

⭐⭐ **Before scoping a fix at a shared site, count the subclasses/callers that reach it.** "I read the site" and "I know who arrives there" are different facts.

## Why my own detector didn't fire

I had *just* written [[feedback_a_leafs_own_state_line_can_contradict_its_body]] — whose rule is "read the body, don't quote the summary." I then became the author of a bad summary within the same hour, on a paragraph I labelled verified. ⚠️ **Holding a rule about summaries drifting does not make my own summary honest**; the rule was aimed at *stored* leaves and I did not turn it on the sentence I was writing. This is the same shape as the depth-zero note in `MEMORY.md`: *holding a rule is not applying it.*

⭐⭐ Cheap discipline that would have caught it: **when a sentence contains N factual clauses and I checked one, either check the rest or drop them.** A shorter sentence I can stand behind beats a complete one I can't. And **never write "verified" as a paragraph-level adjective** — attach it to the clause it covers, or not at all.

## Credit / calibration

The fixer's report also flagged an instrument trap worth keeping: its first correction sweep grepped for **its own memo's** phrasing (`only for Metal`) against the **published** comment text, got 0, and read that as all-clear — but the published text said *"simple **on** Metal"*. ⭐⭐ **Probing a paraphrase of what you wrote is not probing what you published.** Same family as [[feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter]]: the query encoded an assumption, and a 0 result looked like good news.

The published verdict comment `5201487089` was patched in place (5352→5703 chars, correction marked and dated, drift-checked first, comment count still 1) — so the inverted fact had reached GitHub and was corrected there, not just in notes.
