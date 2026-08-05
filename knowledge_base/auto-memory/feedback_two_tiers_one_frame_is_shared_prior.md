---
name: feedback_two_tiers_one_frame_is_shared_prior
description: "Peer agreement on a DISPOSITION is shared prior, not independent evidence — mutual instrument-correction can run ~15 rounds while the decisive RULE goes unread by both tiers; and asking a peer to endorse a disposition converts your frame into their premise"
metadata:
  node_type: memory
  type: feedback
  originSessionId: SELF
---

# Two tiers running one frame is shared prior, not independent evidence

**2026-08-04, slang#12344, Main + `slang-pr-approver`.** The approver proposed `WOULD_APPROVE`; its
own `DECISION_REVIEW` critique reversed it to **`ABSTAIN_POLICY` / `OPEN_GAP`**. It adopted the
reversal and named my share, correctly.

## What happened

The PR adds a markdown-table linter to **two** trees. Its stated purpose is *"close the hole that let
the broken links through."* The `lint_markdown_tables` added to
`docs/generated/design/_meta/regenerate.py` runs in **no CI gate at all**.

Both of us classified that as *"pre-existing CI-ownership, not this author's problem"* and explicitly
declined to charge it. The approver asked my view on the disposition **twice**; I agreed both times,
in writing, with reasoning ("real, pre-existing, discoverable context — not this author's problem").

**MINE-VERIFIED after the reversal, and the classification was simply false:**
- `lint_markdown_tables` in the design tree: **0 occurrences at the verified merge-base
  `ca76f8781acd`** (1556 lines) → **2 at the decided head** (1626 lines) — a definition at `:688`
  **and a call site inside `lint_doc` at `:684`**. Non-zero control: `lint_doc` exists at both
  (1 and 1), so the grep discriminates.
- Design-tree path in CI: **0 of 62 workflow files** reference `generated/design`. Control: the
  tests-tree path matches in `nightly-slang-test.yml` and `ci-slang-coverage-test.yml`.

⇒ **The checker is NEW IN THIS PR and wired into the lint entry point, and nothing will ever run it.**

## The three defects, separated

**1. ⭐⭐⭐ The AGE OF THE FILE LAUNDERED THE AGE OF THE ADDITION.** "Pre-existing" was true of
`regenerate.py` (the script predates the PR) and false of the function inside it. I filed a *new*
artifact as *old* because its container was old. ⇒ **Date the CHANGE, not the file it lives in — a
one-line `git`/API check at the merge-base settles it, and I only ran that check after the reversal.**

**2. ⭐⭐⭐ RIGOR ON EVIDENCE IS NOT RIGOR ON THE RULE.** We spent ~15 rounds correcting each other's
instruments — a payload-truncation defect, an empty-population error, a presence-vs-behavioral check,
a false diff-scope mechanism, an un-laddered absence claim. **Every one of those corrections was real
and not one of them changed the verdict**, which turned on a clause of the decision procedure neither
tier re-read. Step 3's bar included *"or a gap that undermines the PR's stated purpose"* — the
approver had literally written *"'closes the hole' is true of the tool, not the PR gate"* in its own
notes. **The finding existed in words; the predicate was never matched against it.** ⇒ **Before
deciding, re-read the DECISION RULE against your own notes, not just the evidence against reality.**
An unread rule is invisible to any amount of instrument control.

### ⛔ SPLIT THE CLAIM — MEASUREMENT corrections were inert to the verdict; STATE corrections were NOT (approver's correction of my summary, 08-04)

I first wrote this as *"~15 rounds of correction, none of it touched the decision."* **Overgeneralized, and
the approver caught it before I shipped it as the chain's lesson.** The corrections split cleanly by kind:

- **MEASUREMENT corrections** (the five above) all resolved to *"same conclusion, better evidence."* Inert
  to the verdict — that is the finding, and it is what motivates §1 and §3 of this file.
- **STATE corrections changed the decision twice, materially:**
  1. Refuting my *"likely a duplicate"* changed **which SHA was decided on** — without the re-probe, a row
     would have been keyed to `f8bfa0cb98d8` against a harvest that no longer matched the diff.
  2. Holding for the R3 artifact instead of accepting a stale one **changed the findings themselves** — R3
     resolved gap #1 and both blind spots and introduced the front-matter setext finding. *The gap list
     judged was not the gap list started with.*
  3. My `merge_base_commit` check was load-bearing for *"the 9 lint errors are pre-existing"* — a
     non-merge-base base would have made all 9 uninformative **with no visible failure.**

⇒ ⭐⭐⭐**The dangerous misreading is "instrument correction is orthogonal to verdicts," because it licenses
skipping the STATE PRE-FLIGHT — the one check that has actually saved rows** (this PR, and the #12142 stale
replay). **State decides WHICH artifact you are judging; measurement decides how well you judged it.** Only
the second was inert here.

⭐⭐**Meta: this is the position rule biting my own summary.** I had the split available — I *made* both state
corrections — and still compressed them away when writing the headline, because "none of it mattered" is a
tidier lesson than "one half mattered and the other didn't." **Compression toward a clean moral is how a
true observation becomes a false rule.**

**3. ⛔⭐⭐⭐ ASKING A PEER TO ENDORSE A DISPOSITION CONVERTS YOUR FRAME INTO THEIR PREMISE.** The
approver offered the disposition *pre-framed* ("not routing this as a fix demand, agreed?"). I agreed
on the merits **of the frame I was handed**, and it read my agreement back as corroboration. Neither
of us re-derived the classification. ⇒ ⭐⭐⭐**PEER AGREEMENT ON A DISPOSITION IS SHARED PRIOR, NOT
INDEPENDENT EVIDENCE.** Two tiers concurring is worth something only when each reached the position
by its own route — the same standard we had both been applying to *measurements* all session, and
neither applied to the *judgment*.

⭐⭐**The asymmetry is the tell: the conflation ran ONE DIRECTION ONLY — toward approval.** We
collapsed "charging the author" into "declining to approve," and an `OPEN_GAP` abstain is neither: it
means *a human must look*. When a framing error's errors all point the same way, it is a bias, not
noise. ⇒ **Ask of any disposition you are asked to endorse: which outcome does this framing make
easier?**

⭐⭐**Corollary for my tier specifically: I have no approve credential and no clause list, so my
"agreed" carries no procedural weight — but it carries SOCIAL weight to the tier that does.** A
dispatcher's endorsement of a disposition is the same hazard as a dispatcher's hunch arriving as a
directive ([[feedback_debounce_approver_dispatch_deterministic_abstain]]). ⇒ **When a peer asks me to
endorse a disposition, either re-derive it independently or say plainly that I am agreeing with their
framing and have not checked it.**

## What survived, and why this is an abstain not a block

Verified independently and unchanged by the reversal: 6/6 clauses pass; 0 🔴; corpus repairs correct
and load-bearing (dead links **3076/6031 → 0/7007** on the approver's own resolver, design tables
**12 → 0**); widened detector **GFM-precise** (0 deviations incl. 4 must-reject cases); the new
`selftest` **has teeth** (mutation-tested — seed the defect class, confirm targeted failure); gap #1
resolved **behaviorally** (survivor 7/7 vs deleted 5/7); the 9 design lint errors **identical at the
merge-base** and genuinely true, not linter artifacts.

⭐**A reversal that leaves the evidence standing is the healthy shape** — the critique gate changed
the *verdict*, not the *findings*. That is what distinguishes a framing defect from a measurement
defect, and it is why the ~15 rounds of instrument work were not wasted: they are what make the
abstain narrow and legible rather than a shrug.

See also [[feedback_control_the_instrument_not_the_reasoning]] (the instrument-side lessons from the
same exchange) and [[feedback_a_correct_action_does_not_validate_its_rationale]] (state decides
whether to act; premise decides what to say).

## ⭐⭐⭐ 08-05 — THE BOUNDARY OF THIS RULE: agreement measures nothing, but ARTIFACT ACCESS measures a lot

> ⚠️ **EVIDENCE-BASE BANNER — this section only** (the rule above it rests on slang#12344, separately
> evidenced). **ONE chain: slang#12345, Main + `slang-pr-approver`, 2026-08-04/05.** Per this store's
> single-case rule, **re-derive it FIRST when it next fires**; the ⭐⭐⭐ marks severity, **never frequency**.
> Mechanism is strong and readable — *the refuting bytes were on the other machine* — but frequency is
> n=1. ⚠️**Scope note on how this banner came to exist: I banded three sections in
> [[feedback_control_the_instrument_not_the_reasoning]] and left this file and
> [[feedback_unattributed_fact_reads_as_your_own]] unbanded, because I recalled my writes instead of
> enumerating them. My banner's scope claim was narrower than my actual writes** — the same
> enumerate-don't-recall failure the chain is about, committed while fixing it.

Named by `slang-pr-approver` at the close of the slang#12345 chain, which looked like a counterexample
to this file and is not. **Both statements are true and the line between them is the useful part:**

- **Agreement over the SAME artifact adds nothing** — this file's finding. Two tiers ran ~15 adversarial
  rounds over one diff and the decisive rule went unread by both; my written concurrence, twice, measured
  zero. Two bots concurring on a review is one prior, not two observations.
- **A peer MEASURING AN ARTIFACT I CANNOT REACH adds an instrument** — the #12345 chain: **~14
  corrections across two tiers, zero shipped into the decision.** Not because either side was more
  rigorous, but because most of my errors were about *their* container (env vars, config files, gate
  state) and most of theirs about *mine*. **The refuting bytes were on the other machine.**

⇒ ⭐⭐⭐**THE VALUE IS ARTIFACT ACCESS, NOT CONCURRENCE.** A reviewer who can only re-read what I already
read contributes a shared prior. One who can run `echo $CLAUDE_CODE_FORK_SUBAGENT` in a container I cannot
enter contributes a measurement. ⇒ **When a claim turns on state on another edge, ASK THAT EDGE; and never
settle a correction ABOUT ME by re-reading it.** Both directions fired in that chain: I refused a peer's
`merged_by` correction of mine and was **right**; I refused their refutation of my state-reset finding and
was **wrong**. Same resolution both times — whoever held the artifact opened it.
⚠️**Consequence for solo work: this check is STRUCTURAL, not courteous, and a lone agent cannot reproduce
it however many commands it runs.** The gap is reach, not effort. Where no second edge exists, say the
claim is unverifiable from here rather than reasoning harder about it.
⭐⭐**Corollary on "get a second opinion": the useful ask is narrower — get a second party with DIFFERENT
ARTIFACT ACCESS.** Screening for independence of *opinion* selects for disagreement; screening for
independence of *instrument* selects for evidence.
