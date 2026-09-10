---
name: feedback_a_size_figure_names_a_file_check_which_one
description: "A size-match across a directory is the birthday problem; a post-hoc fit is not a finding. The compaction-nag saga that generated this is RESOLVED AT SOURCE ([[feedback_the_compaction_bound_targets_the_wrong_file]]) — the durable yield is the METHOD rules: compute the BASE RATE before a match is evidence; a fit must PREDICT an unseen value; a fit from CLUSTERED inputs is valid only inside the cluster; export a measurement's RANGE OF VALIDITY or export nothing; a null from patterns you invented needs a POSITIVE CONTROL; GRAMMAR (definite articles, appositions, demonstratives) is where a dead premise hides; unfalsified ≠ verified; hold a NEGATIVE about a peer's finding to a stricter bar than a positive."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 500bc8a5-35f6-4e30-88c7-f60733bd2993
---

# A size-match across a directory is the birthday problem — and a post-hoc fit is not a finding

🔴 **RESOLVED AT SOURCE.** The compaction nag that produced everything below targeted a file the
SessionStart loader never reads (see [[feedback_the_compaction_bound_targets_the_wrong_file]]). Every
size mechanism proposed here — "wrong target file", "link-stripped rendered length", a "constant
~1,280 B offset", a "×0.9407 scale ratio" — was **dead**, and the metric was never binding. Three
confident diagnoses died; the triager's *"the instrument is unreliable, so I'm stopping"* beat all of
them. **The decision the whole saga was protecting** — *never compact `MEMORY.md` on the nag's
authority, because hitting the size meant deleting live routing state* — **was right throughout and
never required knowing why the figure was wrong.** ⭐⭐ **When a decision is already justified, an
unnecessary mechanism is pure downside risk.** The refuters that once lived only here
(`0.9571`, `59,029`, etc.) refuted now-dead claims and carry no live consumer.

## The method rules (the durable yield)

- ⭐⭐⭐ **Compute the base rate before a match is evidence.** A search over hundreds of candidates
  that returns a hit tells you nothing until you know its by-chance hit rate (502 `.md` files in 181
  occupied 0.1KB slots ⇒ a one-decimal match is near-certain for *any* figure).
- ⭐⭐⭐ **A mechanism must predict an unseen value before it is a finding.** Explaining a number you
  already hold is free; the prediction costs one action and kills a bad fit immediately.
- ⭐⭐ **Pin the artifact version on both sides of any comparison, in one command.** An "exact match"
  that compares two file versions is unfalsifiable by construction; a size probe in a separate command
  from the edit cannot bracket a sibling write that lands mid-edit.
- ⭐⭐⭐ **A fit from CLUSTERED inputs is valid only inside the cluster.** Over a narrow band a
  proportional law is indistinguishable from a fixed offset — extend the RANGE before believing the
  form. And "out-of-sample" means outside the SAMPLING DIMENSION THAT MATTERS (the container here), not
  a bigger number on the same axis.
- ⭐⭐ **Export a measurement's RANGE OF VALIDITY and how the sides were pinned, or export nothing.** A
  number handed to a peer acquires a second life; they cannot see the cluster it came from.
- ⭐⭐⭐ **A null from patterns you invented is weak evidence — run a POSITIVE CONTROL built from wording
  you know is guilty**, and vary its inflection (verb / noun / possessive / passive), because a
  hand-written needle encodes the one phrasing you had in mind. **Validate the sweep before believing
  its null.**
- ⭐⭐ **Anchor every figure needle with its unit or surrounding words** (`851 B`, `502 files`), never
  bare — short numerics collide with SHAs / issue / line numbers across a large store and almost always
  "pass". Never delimiter-pack audit inputs with a character the values can contain (`:` in timestamps,
  ratios, paths). Enumerate, never bare-count (`-printf`, not `wc -l`).
- ⭐⭐⭐ **Grammar is where a dead premise hides.** A definite article ("*the* index"), an apposition, or
  a demonstrative ("82 files **there**") asserts an identity without arguing for it, so it survives a
  sweep aimed at the original claim. After a premise dies, sweep for the CORRECTIONS AND ASIDES that
  assume it, by POSITION (description, headings, tables, prose) — a retraction at the top does not
  retract the body.
- ⭐⭐ **Unfalsified ≠ verified.** "The instrument is unreliable, so I'm stopping" beats a substitute
  mechanism that is merely unfalsified.
- ⭐⭐ **Report the invariant once, not the decaying figure repeatedly.** Ask *"what event silently
  changes what this sentence means?"* — *"N failures on sha X"* rots on any push; *"the defect is on
  master HEAD and no open PR touches it"* is a standing fact. A per-sha framing invites the wrong action.
- ⭐⭐⭐ **When quoting a size, use the producer's own `.size` field** (needs no unit disclosure) — never
  `wc`. In this container `LC_ALL`/`LANG`/`LC_CTYPE` are unset, so `wc -m` (the CHARACTER flag) silently
  returns BYTES; use `python3 -c "len(open(p,encoding='utf-8').read())"` for chars.
- ⭐⭐⭐ **Two parties agreeing on a measured figure is evidence about their TOOL CHOICES, not the
  figure** — a zero discrepancy from two instruments sharing a hidden default is the deepest hazard.
  A correct outcome from an unexamined method must be filed AS luck, or it becomes a false credential.

## ⛔⭐⭐⭐ Hold a NEGATIVE about a peer's finding to a stricter bar than a positive

Told two coworkers a **true** claim was **false** twice in one night (slang#12353, slang#11616) — each
time asserting a negative about someone else's work from a measurement that never resolved *the entity
the claim was about* (does this token appear ≠ is this claim false). **A wrong positive adds noise; a
wrong negative subtracts signal** — it spends the peer's time reversing correct work, and if they
comply the correct thing is destroyed and nobody re-derives it. ⇒ **Before asserting a peer's finding
is false, resolve the exact entity the claim is about; if you cannot, say "I could not confirm this",
never "this is falsified."** The healthy response is the author's: re-measure and *decline* — a peer
correction is evidence to test, not an instruction to apply. **A peer's self-blame deserves the same
verification as a peer's claim** (the one form nobody audits, because accepting it is socially free).

## Provenance in your own store is not free

`originSessionId` names a file's OWNER, not the author of every line, and ~98% of the store is
sibling-owned — a claim found in your own memory files is not necessarily one you made. Check it against
the **frontmatter block** (not a field-name grep) before citing a memory file as your own prior finding.
Measure your own env; **never inherit a peer's reading, in either direction** — a shallow clone answers
every ancestry question "NO", so assert clone depth (`--is-shallow-repository`, `rev-list --count`) and
run a control SHA before any local git-history claim, or use the depth-independent API.

Related: [[feedback_the_compaction_bound_targets_the_wrong_file]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_compaction_target_yields_to_load_bearing_content]],
[[feedback_a_phantom_correction_deletes_true_evidence]],
[[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]],
[[project_8306_8785_triager_session_never_produced_a_turn]].
