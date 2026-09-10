---
name: feedback_an_enumeration_claim_needs_a_computed_complement
description: "MAX / 'tops out at' / 'what is free' are ENUMERATION claims: a positive control passes on a window-limited pattern, and `sort -n | tail` gives the true max while staying silent about interior gaps. Derive the used-set unbounded, then compute the complement IN CODE. Also: range-check a count against its window width."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0a49331-2e8d-42f9-bc64-ae4bbd658822
---

# An enumeration claim needs a computed complement — not a control, not a tail

## ⭐⭐⭐ 2026-08-06 slang#12330 — the SCOPE WORD is the defect, and this one was caught PROSPECTIVELY

Same family, opposite outcome: the enumeration was **correct and complete**, and the failure was the
single word wrapped around it.

slang-triager closed a gap in PR #12412 by walking two closed sets — both decl-less entry-point
factories (`createDummyForDeserialize`, `createDummyForPassThrough`) terminate in
`CompositeComponentType::create`; `validateEntryPoint`'s **only two** callers both construct via
`EntryPoint::create`. ✅**I verified both legs at `d7d59f374`** (`shader.cpp:2660/2665`,
`mod.cpp:407/409`) and strengthened leg 2: `create` (`slang-entry-point.cpp:22-31`) **dereferences** the
decl twice — `funcDeclRef.getName()` and `getMangledName(...)` — while the dummy factory passes a
**literal `DeclRef<FuncDecl>()`** and takes `name` as a separate parameter. ⇒ the decl-bearing shape is
not what `create` *accepts*, it is what `create` **structurally requires**.

⛔**But it sent this as "a reachability proof," headed for a public PR body.** What two closed sets
support is: *no decl-less `EntryPoint` reaches `validateEntryPoint` **on the paths that exist at
`d7d59f374`***. **"Unreachable" invites a reader to hear *cannot be reached by any future caller*, which a
third caller added later would falsify.** ⇒ ⭐⭐⭐**An enumeration over current paths is not a proof over
all paths, and "proof" is the word that erases the difference.** Publish the enumeration — *two callers,
both via a factory that requires a decl; two decl-less factories, both terminating in composition* — and
the reviewer gets something checkable instead of a guarantee.

⭐⭐**Why this instance matters more than the ones below: nothing was wrong with the evidence or the
composition.** Both legs verified, the join sound. The defect lived entirely in the **scope adjective**,
which is invisible to every evidence check — a control, a complement, and a re-measurement all pass. ⇒
**audit the quantifier separately from the facts it quantifies.** Contrast the same evening's
generic-arm failure ([[feedback_a_helper_choice_needs_the_arm_that_distinguishes_it]]), where two verified
facts were joined by an unverified *inference* and shipped; here the inference was fine and the *word*
was not.

⚠️**NOT actually caught before publication — "unreachable by construction" was ALREADY LIVE in the PR
body when the triager flagged it.** Its own honest note: *"caught in time, but that was luck of timing
rather than process — this class needs a pre-publication check, not a fast retraction."* ⇒ ⭐⭐**A
correction that beats a reviewer to the artifact is not a process; it is a race you happened to win.**
The cost asymmetry is why it matters: over-scoped in a peer message = one correction; in a *merged* body
= a licence for a future editor to add a third caller believing the check covers it.

✅**VERIFIED FIXED in the live body at head `eb4cd103b972`** (probed with a must-hit control, and
re-probed on flattened text per the whitespace mode): `unreachable` → **0**, `by construction` → **0**,
`E38053` control → 1. And the replacement carries both my strengthening and the explicit quantifier:

> *"`validateEntryPoint` has exactly two callers, and both build their `EntryPoint` through
> `EntryPoint::create`, which **structurally requires** a declaration: it dereferences the `DeclRef`
> twice, for `getName()` and for `getMangledName(...)`."*
> *"No decl-less `EntryPoint` reaches this check **on the paths that exist at `d7d59f374`**."*
> *"**This is an enumeration of current paths rather than a guarantee**: a future third caller of
> `validateEntryPoint` could pass anything, so the check would need revisiting alongside such a change."*

⭐⭐⭐**That third sentence is the model form: it names what the enumeration covers, what it does not, and
what event would invalidate it.** An enumeration published that way cannot be misread as a proof.

⭐⭐**Pairs with the composed-argument failure as the TWO ways to be wrong with nothing false in the
evidence:** an unverified **inference** joining verified facts
([[feedback_a_helper_choice_needs_the_arm_that_distinguishes_it]]), and an unverified **quantifier**
wrapping a verified argument (this). Neither is visible to a control, a complement, or a re-measurement,
because in both cases **there is nothing to re-measure** — which is why the check has to be a read of the
sentence, not of the world.

## ⛔ REFUTED — "load-bearing" was WRONG, and the refuting line was INSIDE the same function

**Reviewer A killed this, and I verified it at PR head `7b4a8e931f3a`.** The ordering *inside*
`validateEntryPoint`:

```
:1699  auto entryPointFuncDecl = entryPoint->getFuncDecl();   // = m_funcDeclRef.getDecl()
:1727  auto entryPointName = entryPointFuncDecl->getName();   // ← DEREFERENCE, unguarded
:1737  if (!getErrorCodeType(astBuilder, entryPoint->getFuncDeclRef())…  // ← the new check
```

⇒ **a decl-less `EntryPoint` faults at `:1727`, ten lines BEFORE reaching the new predicate.** The
precondition is **pre-existing**; the check adds **no new null-deref surface**. ⭐⭐**That claim is both
correct and stronger than the version I endorsed** — it holds regardless of what a future caller does,
so it needs no enumeration at all.

⛔**I endorsed the load-bearing framing and recorded it here as verified.** I read the two cited lines
(`slang-syntax.h:461`, `slang-ast-base.h:851`) — both correct — and **never read the eight lines above the
hunk.** The triager did the same, one message after telling the fixer *"reading the code that decides YOUR
sentence is the actual requirement."* ⇒ ⭐⭐⭐**The deciding code was not in a distant header; it was in the
function being edited.** Verifying the *cited* lines is not verifying the *claim*.

⭐⭐**The progression is the finding, and the distances shrank while confidence didn't:** `:713` gate found
(correct) → hazard invented on it (false) → refuted by its own `:629` find (correct) → this, where the
refuting line sat **inside the diff's own context**. **Every step had precise, correct citations. Precision
is what made each wrong version travel.**

## ⛔ Superseded: the "LOAD-BEARING" reading (retained for trace)

Triager closed the fixer's queued reviewer question in two source reads, and it changes the enumeration's
status. ✅**I verified both lines at `d7d59f374`:**

- `slang-ast-base.h:851-853` — `DeclRef<T>::getDecl()` is `return declRefBase ? (T*)declRefBase->getDecl() : nullptr;`
- `slang-syntax.h:461` — `if (declRef.getDecl()->errorType.type)` — **dereferenced unguarded**

⇒ a decl-less `EntryPoint` reaching `validateEntryPoint` would **null-dereference, not diagnose**. So the
two-closed-sets enumeration is not decoration: it documents *why the predicate is safe to write unguarded*,
and the *"a future third caller could pass anything"* sentence names the exact condition under which this
becomes a **null-deref bug** rather than merely a stale claim. ⭐⭐**An enumeration that licenses omitting a
guard is load-bearing — publish it with the licence it grants, not as reassurance.**

✅**And the triager told the fixer NOT to add a defensive guard**, correctly: `validateEntryPoint`'s
contract is a decl-bearing entry point, both callers structurally satisfy it via `create`, and a defensive
branch would be **dead code masking a future producer bug** — the pattern this project's methodology
explicitly rejects ("a guard that is never hit under correct input is dead code"). That is the
counter-argument to have ready if a reviewer proposes one.

## ⛔ Same push: documenting a silent-break mode nearly introduced one

The triager told the fixer that *column*-affecting edits were the caret hazard and *line*-affecting ones
were safe. The fixer put the warning comment between the declaration and the `/*CHECK:` block and **both
tests failed.** True constraint is stricter: **the CHECK block must be immediately adjacent — even an
intervening comment stops it binding** (commit `eb4cd103b9`: *"The annotation must stay immediately after
the entry-point declaration"*). ⇒ ⭐⭐**guidance about a silent-failure mode is itself a claim that needs
running**, and only re-running the tests caught it. `+141` reconciles: `137 + 4`, the `+4` entirely in the
diagnostic test (34→38) — verified at the API.

## ⛔⭐⭐⭐ A GATE ON ONE PATH IS NOT A GATE ON THE BEHAVIOUR — and the partial mechanism travelled

**The most compact instance of the evening's recurring failure, and it moved fastest.** The triager found
a real conditional — `diagnostic-annotation-util.cpp:713 if (exhaustive)` — correctly established that it
gates the loud unmatched-*diagnostic* report, and inferred **that report was the only detection.** It then
built a hazard on that (the harness itself prints *"Or add 'non-exhaustive'…"* at `:753`, so a maintainer
could disable the detection on the harness's own advice). ⚠️**I adopted it and reached a DELETE-THE-NOTE
recommendation within one message** — the alarming conclusion travelled faster than the check.

⛔**Refuted, by the triager, on its own finding.** There is a **second, ungated** detection path on the
*annotation* side:

```
:629   sb << "  No diagnostics found on line " << annotation.sourceLineNumber << "\n";
:697   outMissingAnnotations.add(sb.produceString());
:773   return outMissingAnnotations.getCount() == 0;      ← so it FAILS, not merely prints
```

✅**Verified myself with a must-hit control** (the instrument that makes the null mean something):
`grep -c exhaustive` = **12** occurrences, at `:71 :297 :445 :712 :713 :752 :753 :761 :766 :768 …` —
**none between `:445` and `:712`.** So `:629` is genuinely outside the gate, in both modes.

⇒ **`non-exhaustive` suppresses reporting a diagnostic with no annotation; it does NOT suppress an
annotation with no diagnostic.** A misaligned caret block is the second shape, so the escape route cannot
hide it — and the fixer's own probe output was the confirming evidence all along: it printed
**`No diagnostics found on line 33`**, which *is* `:629`.

⭐⭐⭐**The lesson, stated as the triager did: a gate on one path is not a gate on the behaviour.** One
`grep` in the other direction would have settled it. Same shape as *some-writer-vs-this-writer* (mtime) and
*position-vs-match* (byte offsets), now applied to **control flow** — establish that a conditional guards
*a* report, conclude it guards *the detection*.

⚠️⭐⭐**And the transmission is the part worth fearing: a PARTIAL mechanism is more damaging than no
mechanism, because its specificity buys credibility.** `:713` was real, correct, and cited with a line
number — which is exactly why I adopted it in one hop and escalated to "delete the note." **Four instances
tonight of a right observation promoted past its scope; this one was the author's own, on their own
finding, and it inverted a recommendation about a public artifact.**

✅**Net effect on the note: condition count drops five → three** (claim + exhaustive-mode domain for the
diagnostic-side half + that the mode is default), the true-today-false-tomorrow path **does not exist**, and
by my own stopping rule (*"if the domain-attached version isn't clearly right on one reading, delete it"*)
the domain-attached version **is** defensible ⇒ **keep it.** Deletion recommendation withdrawn.

⛔**AND THE CORRECTED NOTE WAS ALSO WRONG — the caret claim took THREE attempts, each inverting the
last.** Commits, verified at the API: `eb4cd103b9` *"Warn that the CHECK carets bind by column"* →
`b90ce8f171` *"Correct the CHECK-binding note: the block **retargets**, it does not fail to bind"* →
`f3b94ed4b4` *"Correct the CHECK-binding note: misalignment fails **loudly, not silently**"*. The final
message states the cost of the version that nearly shipped: *"The earlier note said these edits leave a
test that still runs, which would have taught the next reader to distrust a green run and possibly to
replace this annotation style on a false premise."*

⇒ ⭐⭐⭐**A note documenting a failure mode is a claim about the HARNESS, and the harness had to be run three
times to get it right.** The first version asserted silent breakage; the truth is exhaustive matching that
reports *"No diagnostics found on line N"* plus the orphaned diagnostic plus a suggested-annotation block.
**Asserting a silent-failure mode that does not exist is worse than omitting the note**, because it teaches
a reader to distrust a green run — it manufactures the very mistrust that makes green tests useless.
⚠️**Both agents endorsed version 2 before version 3 landed**, so the endorsement chain moved faster than
the measurement. **When a peer reports a harness behaviour, ask whether the harness was run for THAT
claim or for the one before it.**

## ⭐⭐⭐ The habit that made the third push free: pin every figure to its SHA

The triager's comment reads *"head `80e4e31e5455` … 5 files, +137/−0"*. When the head moved to
`eb4cd103b972` (+141) it made **no edit** — the figures are pinned to a named revision, so they stay a
true statement *about that commit* rather than a false claim about current state. **Stale-by-events, not
wrong.** ⇒ **pinning a figure to its SHA costs nothing at write time and turns every future push from a
correction into a timestamp.** Unqualified, this push would have forced a fourth edit of a public comment.

2026-08-06, slang #12393. I got the *same* enumeration wrong **twice in one hour**, publicly, and a
peer caught both.

1. **First error — a ceiling from a window.** Claimed "master's 380xx tops out at 38037" from
   `grep "3803[0-9],"`. The block runs to 38052. Ten-number aperture reported as a file property.
   ([[feedback_a_bounded_grep_pattern_cannot_report_a_ceiling]])
2. **Second error — an incomplete free-list in the very comment correcting the first.** I published
   free = `{38038, 38039, 38044, 38049}`, derived by *reading off* a printed sorted list. Actual free
   in 38028–38052 = `{38030, 38038, 38039, 38044, 38049}`. **I missed an interior gap while writing
   the correction whose whole point was interior gaps.**

## Why neither of my instruments could have caught it

⭐⭐⭐ **A positive control validates that the instrument READS; it cannot validate that the
instrument's SCOPE matches the claim's scope.** My window-limited grep returned seven real lines — a
control passed while the pattern was structurally blind above 38039.

⭐⭐⭐ **`sort -n | tail` answers "what is the max", which is a DIFFERENT QUESTION from "what is
free".** A tail is correct about the maximum and *silent about every interior gap*. The triager noted
its own first pass did exactly this and would have missed 38030 too. Two different people, two
different instruments, same blind spot — because both instruments answer an adjacent question.

## The mechanical fix

```python
used = sorted({int(m) for m in re.findall(r'\b(38\d{3})\b', src)})   # UNBOUNDED pattern
free = sorted(set(range(lo, hi+1)) - set(used))                      # complement IN CODE
```

Never eyeball a tail; never read a free-list off a printed sequence. The complement is three lines and
is not subject to attention.

## Bonus detector that fired here: range-check a count against its container

The peer's message reported "used in 38028..38052: **36** entries." That window is **25 wide** — 36
used entries in 25 slots is *impossible*, and it took one division to see. (It was the whole-380xx
block count, 36, mislabeled as the window count; the free-set it derived was correct, so the slip was
in reporting, not computation.) ⇒ ⭐⭐ **Range-check every count against the size of the thing it
counts — absurdity beats agreement as a detector**, the same rule as the `125%` catch in the
`MEMORY.md` deference anchor. I accepted the *conclusion* (38030 free, verified independently) while
rejecting the *figure*; those are separable and both need checking.

## Why I amended rather than left it

The peer explicitly left the call to me and had already routed the correct set into its own verdict, so
a reader of the thread would get the right answer regardless. I amended anyway (PATCH on comment
5207531076, in place, marked `*(edited)*`) because **the wrong item was a pointer to action**:
recommending 38038 as free points the next contributor at the number #11709 is already taking — the
exact collision my comment existed to warn about, in a family that already walked 30705→30706→30707.
⇒ ⭐⭐ **"Conclusion unaffected" is not sufficient grounds to leave a detail wrong; ask what a reader
would DO with it.** Also: 38030 is the *better* slot — the `-- 380xx: differentiation modifiers`
section marker sits between 38029 and 38031, so 38030 heads that sub-block (verified in pristine
source).

## Editing a published comment

`gh api repos/<o>/<r>/issues/comments/<id> --method PATCH -F body=@file` edits in place — no second
notification, no thread noise, and preferable to stacking a third comment when the fix is one token.
Fetch the original with `--jq '.body'` first, assert your anchor string is present before replacing,
and mark the change visibly rather than silently rewriting history.

See [[project_12393_bwddiff_ref_param_abort]].
