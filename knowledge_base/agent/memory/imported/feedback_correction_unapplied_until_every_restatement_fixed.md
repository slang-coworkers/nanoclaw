---
name: feedback_correction_unapplied_until_every_restatement_fixed
description: "A retraction filed as an APPEND leaves the original claim standing where readers land first — headings, tables, titles, frontmatter, index rows outrank prose, so sweep them highest-risk-first. Editing is not appending. Invert the sweep: grep retraction MARKERS, not remembered content. The mechanism underneath: rule-application follows ATTENTION not SCOPE — enumerate the stale instances, don't recall them, and attach the sweep to STATE transitions. (Sweeping by INSTRUMENT and INFERENCE, the numberless forms, is the sibling axis: [[feedback_sweep_a_correction_by_instrument_and_inference]].)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# A correction isn't applied until every restatement is fixed — and POSITION decides which one is read

**2026-08-04, Main + slang-pr-approver, converged from both sides in one exchange.** This is the
POSITION axis and the mechanism underneath it. The orthogonal INSTRUMENT and INFERENCE axes — a correct
measurement camouflaging a wrong conclusion, the numberless / runnable-recipe forms of an error — live in
[[feedback_sweep_a_correction_by_instrument_and_inference]]. Run all three axes.

## The defect
Retracting a claim by **appending the correction** leaves the original standing. The append satisfies the
author (the record is now complete) and fails the reader (they hit the original first and stop). Both
tiers committed it the same day: a retracted "805×4" at line 21 while line 19 still asserted it as the
enumeration; an approver expecting 0 survivors and finding **6**.

## The positional half — restatements outrank prose
**Restatements in headings, tables, titles, frontmatter and index rows OUTRANK prose, because they are
what gets read *instead of* the body.** Every one of the approver's six survivors sat in a position a
reader reaches *before* the correction (a retracted over-claim still in the `##` heading with the fix 80
lines below; `⇒ FALSE-SAFE RISK` still in a table cell; a stale count in a bullet; title + frontmatter
saying "2 rows" while three existed). "I appended a correction" is not done.

**Sweep order, highest-risk first** (four positions, in read-order risk):
1. `##`/`###` headings · file title + frontmatter `description:`
2. table cells · index / summary-list rows (`MEMORY.md`)
3. **conclusion bullets** (⛔/✅ lines below a banner still read as the file's findings)
4. **exemplars & prescribed wordings** — ⭐⭐⭐ a claim in the RECOMMENDATION slot is more load-bearing
   than the same claim asserted, because a reader copies it forward. Sweep the "do it like this" blocks.
5. body prose (least-read; do not assume a clean sweep covered it — record what you did NOT sweep rather
   than inherit false completeness)

⭐⭐ **Separate the SHAPE from the INSTANCE when correcting one.** "Lead with the resolution" survives;
*this* resolution's wording does not. Fixing the whole row would have destroyed a good rule.

## Editing is not appending
⭐ A retraction is an *edit to the assertion*, plus optionally a note explaining it. Appending only the
note is a half-application that looks complete in a diff. This applies to the ACT of editing too: an
`old_string` that matches only the *opening* of a long line silently converts a replace into a **prepend**
— I "compacted" a 2947-char row and grew it to 4036 by leaving the original tail in place. ⇒ When
rewriting a long single-line entry, match the whole line (or rewrite by line number), never just its head.
⭐ **A size check is a correctness check here:** if a compaction edit doesn't shrink the file, it did
something other than intended (`awk '/pattern/{print length($0)}'` before/after distinguishes replace from
prepend in seconds).

## Invert the sweep — grep MARKERS, not remembered content
We each grepped for retracted phrases we could REMEMBER, so phrases we've forgotten retracting are
unreachable by that method. The fix is memory-independent by construction:
```bash
grep -lE 'RETRACTED|WAS WRONG|⛔.*WRONG|SUPERSEDED' *.md   # every file holding a retraction
```
Then for each marker, verify a *corrected value* actually follows it (an orphan marker = a retraction with
no replacement). ⚠️ **A sweep result is a claim about your sweep until you spot-check its hits** — my first
verifier flagged 13 "orphans," all 13 false positives (the corrections sat just beyond its window).
**Ladder every hit, not just every zero.**

## ⭐⭐⭐ The mechanism underneath the whole family: rule-application follows ATTENTION, not SCOPE
`slang-fixer`'s self-diagnosis on PR #12417 is the best explanation this file has had. In one edit it
removed a challenged autodiff figure but left a CI census citing a superseded SHA in the same document:

> *"The autodiff number was salient because a reviewer had just challenged it, while the census SHA was
> inert prose I'd stopped reading."*

⇒ **A document has SALIENT and INERT regions, and a correction sweep only touches the salient ones** —
which is *worse* than not holding the rule, because it produces the appearance of a sweep. The fix is
procedural, not attentional: after any head/version/date change, **ENUMERATE which numbers and SHAs are
now stale — never "did I fix the one I was thinking about?"** Recall is the failing faculty; enumeration
is the substitute. One family, one remedy:

| scope | rule |
|---|---|
| within a document | a correction is not applied until every restatement is fixed (this file) |
| across published artifacts | after correcting a published fact, grep the session for it |
| across a head change | enumerate the stale SHAs/figures |

### Attach the sweep to STATE transitions, or it never fires
⭐⭐⭐ **A STATE change is not perceived as a DOCUMENT change**, so the enumeration above never gets
triggered — a PR body went stale across two events and *"neither felt like a body change."* Attach the
sweep to the transition (draft→ready · defect found · head moved · verdict received), not to the act of
editing prose. ⚠️ The PR body is the safest place to put a warning **and** the most dangerous place to
leave a stale claim: *"Status: fixed"* answers the reader's question, wrongly, where they read first.

## Companion rules earned in the same exchange
- ⭐⭐ **A rule protects only when EXECUTED as a step, never as a principle recalled.** Filing a rule
  confers no protection against it — the interval between writing "editing is not appending" and violating
  it was a single tool call. Cf. [[feedback_control_the_instrument_not_the_reasoning]] (a checklist
  executed at the point of claiming). Having this file did not help; running the sweep would have.
- ⭐ **A run of wrong proposals on ONE question is evidence about your model of that question, not bad
  luck** ⇒ hand the design call to the owner rather than producing a fourth. (Self-directed complement to
  [[feedback_deference_drifts_to_whoever_corrected_you_last]], which governs *others'* track records.)
- ⭐⭐ **Match the check to the claim:** membership → `get`; completeness → BOUND test; identity → hash.
  Two membership checks feel like independent verification and are blind to omission
  ([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]).
- ⭐ **Mutual refusal beat agreement:** each declined the other's figure pending our own measurement,
  which is what surfaced two tool defects an agreed-on number would have buried.

Related: [[feedback_sweep_a_correction_by_instrument_and_inference]] (the instrument/inference axes),
[[feedback_consistency_is_not_completeness_in_review]] (a correction is itself a relay),
[[feedback_compaction_target_yields_to_load_bearing_content]] (Mode-4 orphaning),
[[project_critique_gate_pulls_pattern_builtin_floor]].
