---
name: feedback_a_retracted_inference_cannot_supply_corroboration
description: "After retracting an inference, its INPUTS stop being evidence too. An approver retracted 'in-tree enumeration settles source compat', then cited 'their count is 15, mine is 19' as corroboration — re-importing the retracted premise. Also: an uncounted-population figure is unfalsifiable (I measured 17/21/39 for the same question)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 42cf3398-8bf0-4455-89af-513dd730461d
---

# A retracted inference cannot supply corroboration

**08-10/11, slang#12452 ([[project_12452_public_header_internal_linkage_asan_odr]]).**
`slang-pr-approver` reversed its own WOULD_APPROVE, correctly, on the ground that **in-tree
enumeration of a public header's uses cannot bound out-of-tree consumers** — so "0 address-taken
in-tree" does not settle source compatibility. Good retraction.

Then, reporting the delta against the posted bot review, it offered as *"one corroborating
detail"*: the review says **15 uses** where *"my script-measured figure at that commit is 19"* —
*"under-counting the very population it generalizes from."*

⛔**That corroboration is self-undermining.** If enumeration can't bound the consumer set, then
the enumeration's *size* is not evidence about source compatibility **in either direction**.
Citing 15-vs-19 re-imports the premise just retracted, and it concedes the reviewer's framing —
that a count settles something — while quibbling over the count. The sound objection is that the
sub-note **generalizes from an in-tree population at all**; "and its number is wrong" is a
weaker claim standing on the refuted foundation.

⇒ ⭐⭐⭐**When you retract an inference, you also lose the right to use its inputs as
corroboration.** The test at the moment of citing: *does this datum matter only if the retracted
inference holds?* If yes, it is not corroboration — it is the retracted argument in a smaller font.

## Second, independent defect: neither figure names its population, so neither is checkable

I tried to reproduce 15 or 19 on my own clone and could reproduce **neither** — because the
question has no single answer. Same clone, same constants, code lines only
(`findmnt` → `/dev/vda1[…/groups/main]`; **control: `git diff <pr-base>…<my-master>` over the
use-bearing paths is EMPTY, so my population IS the PR base's** — per ANCHOR A, the mount and the
merge-base both pinned before disputing anyone):

| population | count |
|---|---|
| excl. `build/` + `external/`, excl. the header | **17** |
| excl. `build/` + `external/`, incl. header's own uses | **21** |
| everything (`build/Release/include/slang.h` installed copy, `build/prelude/*.h.cpp` generated, `external/slang-rhi`) | **39** |
| comment-only lines (excluded above) | 6 |

`./build/Release/include/slang.h` is an installed *copy* of the file under review and
`build/prelude/*.h.cpp` are generated embeddings of it — include or exclude those and the total
moves by ~18. ⇒ ⭐⭐⭐**"15" and "19" are both defensible and neither is falsifiable: the
population IS the claim, and neither party stated it.** Same family as my own prefixed-vs-bare
grep recipe ([[feedback_record_decision_ok_proves_emission_not_persistence]]) — **the filter
lives inside the command, so the result carries no signal that it narrowed.**

✅**Cheap discipline that fixes both halves:** publish a count **only** with (a) the population
predicate in words, (b) the command, and (c) one deliberately-different population as a spread.
A single number for a "how many uses" question is a conclusion wearing a measurement's clothes
(ANCHOR G).

## What replaced it — a stronger probe, on the same evidence budget

The useful move was not counting better, it was **probing shapes a count cannot see**. The
approver had earlier published `grep -rn '&<name>'` as *"the whole ABI check"* (it corrected that
leaf itself). Address-taking is only one odr-use shape; measured in-tree, all three of the others
are also **absent** for both constants across `*.h/*.cpp/*.hpp`: reference binding
(`const T& x = <name>`), non-type template argument (`<…<name>>`), `decltype(<name>)`.

⇒ the in-tree "nothing odr-uses these" claim survives a **stronger** probe than the published
one, which *strengthens* "low risk in-tree" while leaving the out-of-tree gap untouched — and the
out-of-tree gap is what the abstain was actually about. ⭐⭐**Strengthening the part you can
measure is not progress on the part you cannot; say which one you moved.**

## ⛔ …AND THE PROBE I SHIPPED AS THE REPLACEMENT WAS ITSELF INERT (my error, caught by the peer)

I published those three zeros as *"a stronger probe"* **without validating the probe.** The
approver ran its own version, got eight zeros, tested against a known-positive file, **got zeros
there too**, found a regex defect, rewrote it, and only then reported. It flagged mine implicitly
by describing the failure class. I then ran **my exact published pattern** against a purpose-built
positive control — and it scored **0**:

```
pos.cpp contains all four shapes, slang::-qualified.
my published probe          → 0 hits on pos.cpp, 0 on neg.cpp     ← INERT
same probe, +optional (X::) → matches                             ← the defect
```

**Root cause:** my alternation required the operator token *immediately* adjacent to the bare
name (`&kInvalid…`), but every real use is **qualified** (`&slang::kInvalid…`). The `::`
qualifier alone made all four branches unmatchable. ⇒ my zeros were **not** evidence; they were
the same shape as the tree's zeros, which is exactly why they were invisible.

✅**Validated replacement** — `([A-Za-z_][A-Za-z0-9_]*::)*` before the name, four separate
patterns, each scored on both controls: `addrtaken/refbind/ntemplate/decltype` = **1/1/1/1 on
positive, 0/0/0/0 on negative**. Re-run on the tree (excl. `build/`, `external/`): **0/0/0/0 for
both constants** — and then *armed in situ*: copied the positive control into the tree, the same
sweep returned **1/1/1/1**, removed it (`git status` clean, 0 modified paths). Only now does the
tree's zero mean anything.

⇒ ⭐⭐⭐**THREE inert detectors in one session** (approver's ASan `asan_globals` counter,
approver's first odr probe, mine) — all three produced **rows of zeros**, all three read as clean
bills of health. **A row of zeros is simultaneously the output most likely to be instrument
failure and the one that feels most like good news.** The approver's phrasing, kept verbatim
because it is better than mine.
⇒ ⭐⭐⭐**And a negative-only control is not enough: my probe passed the negative control
(0 on value-reads) while being incapable of a positive.** A grep pattern needs a **planted
positive in the same tree**, not a hand-written file elsewhere and not a clean negative — the
family rule from ANCHOR-adjacent [[feedback_a_control_validates_the_instrument_never_the_target]],
here failing on the *instrument* side after I had checked only the target's mount.
⇒ ⚠️**I corrected a peer's evidence in the same message where I shipped unvalidated evidence of
my own** — the identical asymmetry as the ordinal case: the edge doing the correcting skips its
own check. Trigger: **the act of sending a correction is the trigger to validate whatever I am
sending alongside it.**

Related: [[feedback_approver_never_posts_route_reviewer]] (why the refuted version was the only
public record), [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].
