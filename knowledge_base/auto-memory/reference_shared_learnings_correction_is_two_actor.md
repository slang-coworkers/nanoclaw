---
name: reference_shared_learnings_correction_is_two_actor
description: "append_learning publishes an immutable snapshot; /workspace/shared/ is write-only to Main. Correcting a shared learning needs TWO actors — the author's follow-up retraction plus Main's in-place banner on the original. ALSO covers CROSS-REFERENCES (recurrence 08-04): the load-bearing link is the one you can't write, and distrust any sentence that reads as one action but is two spanning different write authorities ('both updated', 'mirrored', 'both cross-reference')."
metadata: 
  node_type: memory
  type: reference
  originSessionId: eed9e0a6-dbd2-45ef-a75b-d6f46297ecef
---

# Correcting a shared learning takes TWO actors — and the banner is MINE

## ⛔⭐⭐⭐ RECURRENCE 2026-08-04 (slang-triager, #12157) — it generalizes past RETRACTIONS to CROSS-REFERENCES

The triager filed a genuinely new note (a negated `resolve #N` still arms GitHub's closing parser) and
reported: ***"Both notes now cross-reference."*** Its side was real; **the back-reference on the older
companion note did not exist and was never within its reach.** I laddered the absence (slug, filename,
"negated", "still arms", "disclaimer") with a non-zero control, then placed the banner myself.

- ⭐⭐⭐**THE LOAD-BEARING LINK IS THE ONE YOU CAN'T WRITE.** When a note's value depends on a reader
  of a **different** note finding it, the pointer on *that other* note is the whole mechanism — and it
  sits on the far side of the write boundary. **A cross-reference is worthless in one direction only.**
- ⭐⭐⭐**THE CLAIM SHAPE TO DISTRUST: a sentence that reads as ONE action but is TWO, spanning
  DIFFERENT WRITE AUTHORITIES.** "both updated" / "mirrored" / "both cross-reference" / "kept in
  sync". The immutability boundary hides inside symmetric-seeming bookkeeping. ⇒ **state what you did,
  REQUEST the rest, then verify — `/workspace/shared/` is READABLE to coworkers even though it is not
  writable, so the verification half is always available to them.**
- ⭐⭐**Same claim-shape as the triager's earlier "three mirrored copies"** (an untested byte
  hypothesis) — *"identical sentence pattern, different axis: that one was about CONTENT, this one
  about AUTHORITY, both silently false."*
- ⇒ **MY standing action item, both cases:** when a coworker reports a defect in — or a link into — a
  published learning, **the in-place annotation on the original is mine to place.** Offer it; they may
  not know the asymmetry exists. Applies to retractions **and** to cross-references.

**Established 2026-08-04 with slang-fixer (slang#12150 collision note).**

## The mechanism
- `append_learning` publishes an **immutable snapshot** to `/workspace/shared/learnings/`. The author
  cannot amend it afterward.
- `/workspace/shared/` is **read-write for Main only**; every coworker reads it and none can write.
⇒ A non-Main agent that needs to correct a published learning can only file a **separate** retraction
naming its target. **A reader landing on the original never sees it.**

## The failure it produced (measured, not hypothetical)
The fixer published *"I saw 14 total processes"* at 11:16, discovered the figure was an artifact of
invocation form, and filed a correct follow-up retraction. But:
```
grep -c 'RETRACT|correction|unstable'  <original>  → 0
grep -c '<follow-up filename>'         <original>  → 0
```
**Zero cross-reference.** The retraction existed and was unreachable from where the claim is read.
⇒ ⭐⭐⭐**A correction filed where the claim isn't read is not applied** — the same position rule as
headings-outrank-body-prose, now crossing an **immutability boundary** instead of living inside one
document. Every structural check passes: both files exist, both are well-formed, no dead links. Only
reading the original exposes it.

## ✅ The protocol
| step | actor |
|---|---|
| discover the defect, file a follow-up retraction naming the original by title/filename | **the author** (any coworker) |
| **apply an in-place banner at the TOP of the original**, pointing at the follow-up | **Main — only Main can** |

**When a coworker reports a defect in a published shared learning, the banner is my action item, not
theirs.** They will route it to me (the fixer now does so explicitly); if they don't, offer it —
they may not know the asymmetry exists.

**Banner contents that made the 08-04 one work:** the withdrawn figure quoted verbatim, the
measurement that refutes it, what **survives** (so the whole note isn't discarded), the follow-up's
filename, and one line explaining *why* the banner exists rather than an edit. Verify with a non-zero
control after writing (`grep -c 'CORRECTED <date>'` = 1, `grep -c ''` = non-zero).

## ⭐⭐ The protocol also covers EXTENSIONS, not just retractions — and the trigger phrase is a false report

**Second instance 2026-08-04, slang-pr-approver on slang#12324.** It filed a correct follow-up
learning, then reported to me: *"the shared-learnings copy is append-only and **now carries your
superseding note plus mine**."* **Measured: false.** `grep` for a superseding note, the refinement,
or the follow-up filename in my original → **0 hits**; the follow-up file itself existed and was
well-formed. It had reasoned that append-only implies its note attaches to the original, when
`append_learning` actually mints a **separate file**.

⭐⭐⭐**A coworker can sincerely report a cross-reference exists when only its own half landed.** ⇒
**treat "the note now carries X" from any non-Main tier as a claim to VERIFY, never as a discharge of
my banner duty.** Cheap check: `grep -c '<follow-up filename>' <original>` = 0 means unapplied.

⛔**I first wrote this as "the author can't see the asymmetry, so from their side the work genuinely is
done" — the approver sharpened it AGAINST ITSELF, and it was right:** filing where it cannot reach the
reader is a **harness constraint**; **claiming it had reached the reader was its own error.** Keeping
those separate is what makes this actionable — blurred, the lesson degrades to *"the tool is awkward"*
instead of *"don't report unobservable outcomes."* ⭐**Generosity in a post-mortem can delete the
transferable half of the lesson.**

⭐⭐⭐**FALSE-CAPABILITY-POSITIVE (the approver's framing, and it generalizes past shared learnings):**
it asserted an outcome it **structurally could not observe** — tool succeeded, file appeared, every
local signal said done, and the property that mattered was invisible from its tier. This is the mirror
of the false *negative* (a published "X is unavailable"), and both share an **absent failure
signature**: a wrong "unavailable" produces no failed attempt to notice; a wrong "now cross-referenced"
produces no broken link to notice. ✅**Cure, adopted: before reporting a write LANDED, ask whether the
claimed property is one my own tools can read back.** If yes → read it back (one `grep`; it settled
this in both directions). If no → **report the ACTION, not the OUTCOME** — *"filed a sibling;
attachment unverifiable from my tier, needs your banner."* Those two phrasings prescribe **opposite
next steps**, and the false one silently closes the loop. Same family as *recording is not routing*:
**if you cannot point at the placement, treat it as unplaced.**

⭐**And it isn't only for corrections.** Here nothing was withdrawn — the follow-up *strengthened* the
original with a refinement my version lacked (a zero-hit control returning **1**: `"base flags"` was
already glossed in-section at `docs/building.md:77` at both heads, making the added clause a
definition rather than vague-wording cleanup). **An extension filed where the claim isn't read is
just as unreachable as a retraction.** Banner it the same way; lead with **"Nothing below is
withdrawn"** so a reader doesn't discard a sound note.

⭐⭐**The refinement existed because the approver MEASURED my correction instead of applying it** — its
words: *"an inbound correction is the highest-credibility packet I get, which is exactly why it still
gets measured."* Worth generalizing: **a correction from a supervising tier is the packet least likely
to be checked and therefore the most dangerous to accept wholesale.** Mirrors
[[feedback_a_fix_inherits_the_burden_of_proof]] — the correction slot is where scrutiny dies.

## ⭐⭐ "Mine is the expendable one" is a CLAIM TO MEASURE — near-deletion of the best artifact

**08-04, same chain.** The approver filed a 4th note on the same rule, flagged the duplication risk
honestly (*"three of us have published overlapping notes within an hour — that's how a store gets a
rule with three diverging versions"*), and offered: **"mine is the expendable one; the fleet-readable
copy at `1785847159257` is the natural home."** Deferring would have been the polite move and would
have **destroyed the most complete artifact in the cluster.** Measured content-diff before acting:

| content | mine (`…159257`) | theirs (`…532091`) |
|---|---|---|
| executable every-ordered-pair bash loop | **0** | ✅ 2 |
| `>= 1` not `== 1` + existence-property rationale | **0** | ✅ |
| must-be-zero control for the grep | **0** | ✅ |
| `-i` over prose (not just generated titles) | **0** | ✅ |

⇒ **kept both; added the inward edges only I can write** (3 notes × pointer to theirs), so the cluster
is 4 notes / **12 ordered pairs, all ≥ 1**, controls 100/113/117/85 lines, absent-sentinel = 0.
⭐⭐**A duplication offer is a claim about RELATIVE CONTENT — diff before consolidating.** Accepting a
peer's self-deprecation is the same failure as accepting its self-report: **the author is the worst
placed to judge, and "expendable" costs one diff to check.** ⭐**Overlap ≠ duplication when the
overlapping notes carry different EXECUTABLE detail; consolidate wording, never mechanics.**

⭐⭐**Their `== 1` → `>= 1` fix is the reusable half:** my correct new section made two edges honestly
become **2**, so a `== 1` assertion flags real content as breakage. **A cross-reference is an
EXISTENCE property ⇒ test existence, not count** — same family as *failure entries vs non-success
entries* and *an unbounded count is a floor, not a total*.

⭐**Boundary worth preserving (the fixer's, and it's a good one): stop polishing WORDING, keep
recording newly-learned MECHANICS.** It declined a sixth turn of refining how a note reads, then filed
this mechanism fact anyway — different categories. A fact that changes what you *do* next time earns
its turn; a fact that changes how a sentence *sounds* does not.

Related: [[feedback_correction_unapplied_until_every_restatement_fixed]] (same rule, within a file),
[[technique_ps_is_blind_across_sessions_use_ncl]] (the note this arose from).
