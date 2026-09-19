---
type: feedback
name: feedback_correction_must_sweep_whole_file
description: "A correction is not applied until you ask WHERE ELSE the claim lives — same file, shared atoms, synthesized wiki, mirrors, index lines, titles. Grep the superseded wording, since a search for your new phrasing cannot match what it replaced"
metadata:
  node_type: memory
  type: feedback
  title: "A correction appended is not a correction applied: sweep the whole file"
  tags:
    - memory-hygiene
    - verification
    - compaction
    - provenance
  originSessionId: unknown-prior-session
---

# A correction appended is not a correction applied

**Rule:** when you retract or weaken a claim in a durable note, **read the whole file end-to-end and remove every surviving assertion of the old claim.** Appending a corrected section leaves the original standing; a later reader hits whichever paragraph they reach first, and both read as current.

**Why:** observed twice independently in one turn (2026-08-03, slang-rhi#800), which is what makes it a rule rather than an incident:

- **Mine.** I corrected "Devin's residency 🔴 is REFUTED" → "NOT-BLOCK but NOT-CLEARED" with two targeted `Edit`s. A full re-read then found the old claim still live in **three** other places, including an entire duplicate `## ✅ MERGED` section asserting *"Devin's residency 🔴 stayed refuted through merge"* and *"Not yet verified by me: whether `compute-indirect*.metal` actually printed PASSED"* — both already disproved that same turn. Fixed only by rewriting the file whole.
- **The approver's.** Same shape in its own R1/R2 sections, and it reported the same discovery path: *"caught only on a full end-to-end re-read rather than a targeted grep."*

**The mechanism is why a grep won't save you:** you naturally grep for the wording you just wrote (`NOT-CLEARED`, `overclaim`) to confirm the fix landed. That pattern **cannot match the stale text**, which uses the old vocabulary (`refuted`, `unverified`). A search for your correction is not a search for what it was meant to replace. To sweep properly, grep the **old** claim's distinctive terms, or just read the file.

**The bigger question the file-level rule misses: WHERE ELSE does the claim live?** (slang-pr-approver's
sharpening, 2026-08-03, and it caught a gap my version had.) A correction is not applied until you
enumerate every surface holding the claim — **private notes, shared learning atoms, the synthesized
wiki, mirrored copies, index/topic pointer lines, frontmatter titles, embedded JSON**. On slang-rhi#800
I had corrected my own store and *reported the chain closed*; the shared store still taught the retracted
version to every coworker's Step-0 recall. Concretely, the residency claim lived in **seven** places
beyond my own file: the root learning atom, its `wiki/learnings/` mirror, its `sources/learnings/` copy,
`wiki/concepts/review-approver-challenger-calibration.md` in two sections, `wiki/index.md`,
`wiki/topics/slang-compiler.md`, and a second atom presenting it as an *execution-backed* refutation.
Fixing one file left six live.

- **A synthesized/derived layer inherits the error and must be corrected separately.** Wiki concept pages
  quote and re-frame atoms; the framing (`false-positive refutation` as an archetype) is what teaches, so
  a corrected atom under an uncorrected headline still misleads.
- **Titles and pointer lines are what recall shows first.** Flag the stale H1/`title:` and every index
  line, not just the body — a reader may never open the file.
- **Under an append-only convention, a correction is only as reachable as the vocabulary it quotes.** File
  the retraction quoting the superseded sentences *verbatim*, so a grep for the old words lands on the
  correction. Name the controlling account explicitly.
- **Retract at paragraph granularity.** Keep what survives (here: the Metal residency taxonomy and a
  coverage checklist) and retract only the inference that overreached — wholesale deletion loses good work
  and invites re-derivation.
- **Shared stores may be write-restricted.** `/workspace/shared/` is Main-write-only, so a coworker
  *cannot* repair its own error there — it can only report it. If a coworker flags a stale shared claim,
  that repair is Main's to perform, not to acknowledge.

**⚠️ The rule as first written had only its NEGATIVE half — and that gap bit us at the very end of the chain (17:30Z).** Everything above says *sweep out the stale claim*. Nothing said *verify the new one landed where it needs to be*. Measured on this file: the negative instruction appears twice, the positive **zero** times. The approver hit exactly that hole — it checked that the over-general "all seven" claim had **not** reached the shared atoms (negative: clean) and never checked whether the corrected two-controls split **had** (positive: it hadn't — the conclusion existed only in the message transcript). A conclusion that lives only in a transcript is not recorded; cf. [[feedback_recorded_is_unfalsifiable_across_tiers]].

**⚠️ A surface class this rule never enumerated: the AUDIT ARTIFACT OF RECORD (2026-08-03, slang-rhi#806).** Every surface listed above is a *note* — private store, shared atom, wiki, index line. The approver's sweep of a retracted "two independent sources" claim found **five** contaminated surfaces, and one was the `challenger` field of the **already-recorded `approval_decisions` ledger row** — the very artifact a human would later audit to reconstruct the decision. It re-recorded in place (idempotent on `(repo, pr, commit_sha)`; verdict/commit/join unchanged, no duplicate row). ⇒ **when a correction touches reasoning you have already EMITTED into a durable record — a ledger row, a posted GitHub comment, a PR description, a filed report — that record is a sweep surface too.** It is the worst one to miss: notes mislead your future self, but the audit artifact misleads the *human reviewing whether the process worked*, and it carries the authority of being the official record. Reason-fields inside a structured row are especially easy to skip because the row's *headline* values (verdict, SHA) are still correct.

Two mechanics from that instance worth keeping: **(a)** two of the five surfaces were copies a *concurrent linter restructure* had made of the flawed text into an archive file — they survived earlier rounds precisely because those rounds fixed "the original," so **a sweep must re-enumerate surfaces at sweep time rather than trusting a list built before other agents touched the tree**; **(b)** the approver's own tell was an **asymmetry visible in its transcript** — it had run `commits?path=` on `LICENSE` but never on `dep5`. ⇒ **when a check is applied to one element of a pair, ask why not the other**; cf. [[feedback_name_what_you_held_fixed]].

⇒ **A correction has two verifications, and they are not the same query:**
- **Negative:** the superseded wording is gone from every surface. `grep` the OLD vocabulary.
- **Positive:** the replacement is PRESENT on every surface that needs it — including tiers you don't own and stores a peer can't write. `grep` the NEW vocabulary, per surface.
Doing only the negative half leaves a **hole rather than a wrong answer**, which is why it survives review: nothing contradicts a claim that is simply absent. This is the same asymmetry as over-correction being a false negative you chose.

**📁 The thirteen-error case study from slang-rhi#800 — including the five error classes, the
carry-through instances, and the verifier-is-subject-to-its-own-class rule — is in
[[feedback_sweep_rule_case_study_rhi800]].** Read it for worked examples; the rule itself is above and below.

**How to apply:**
- After any retraction, `Read` the entire file — not the edited region. Cheap relative to a wrong durable fact.
- Grep the **superseded** vocabulary, not the new. List the old claim's load-bearing words first, then search for those.
- Watch for **duplicate sections** describing the same event from different turns (two `MERGED` / `TERMINAL` / `RESOLUTION` blocks). Compaction and successive appends both produce them, and the older one usually holds the stale position. Consolidate rather than adding a third.
- **Compaction is a live source of resurrection.** In this same turn, a concurrent compaction rewrote the `MEMORY.md` index line for #800 with two claims I had already disproved — because it summarized from a per-PR file that still contained them. If index lines are regenerated from topic files, **a stale line in the source propagates silently**; fix the source file first, then the index. Verifying link integrity does not detect this — links resolved fine while the prose was wrong.
- Corollary for index files: **re-read an index line before editing it.** Don't assume your own last write is what's there.

## Split-out concepts (folded 2026-09-18 by /okf-synthesis)

This file now holds only the core sweep rule. Three lessons that had accreted here were relocated:

- [[feedback_relevance_and_provenance_are_two_controls.md]] — the slang-rhi#800 "one defect, four guises" case study (relevance vs provenance as two disjoint controls).
- The "a resume trigger goes stale silently" lesson was merged into the canonical resume-trigger file [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind.md]] (no rival keyed file).
- [[feedback_separate_perishable_from_durable_before_parking.md]] — classify published claims before parking a chain.
