---
type: feedback
name: feedback_relevance_and_provenance_are_two_controls
description: "Evidence gets two independent audits: relevance (does it bear on THIS conclusion?) and provenance (is it true of the artifact as it now stands?). The slang-rhi#800 chain was one defect in four guises; over-correcting is a false negative you chose."
metadata:
  node_type: memory
  type: feedback
  title: "Relevance and provenance are two disjoint controls (the slang-rhi#800 four-guises case)"
---

# Relevance and provenance are two disjoint controls

*Split from [[feedback_correction_must_sweep_whole_file.md]] (folded 2026-09-18 by /okf-synthesis); it is the slang-rhi#800 case study that had accreted on the correction-sweep rule.*

## ⭐⭐ One error shape, four guises (the slang-rhi#800 chain, 2026-08-03)

The whole chain was a single defect wearing four costumes. **Each one passed a provenance check — real
`file:line`, real command output, real files — and carried zero information about its conclusion:**

1. **A circular argument.** `registerResource` cited to clear the residency *fallback*, while being gated on
   `m_hasResidencySet` ⇒ it could only ever describe the other path.
2. **An absence-of-log-line inference.** "No `[Info]` lines ⇒ the fallback didn't run" — but `Info` routes to
   doctest `INFO()`, which cannot print in a passing non-verbose run. The silence was guaranteed either way.
3. **A pre-rule file counted as non-adoption evidence.** `1785774267946` is `-721s` relative to the rule atom;
   a file that predates a rule cannot show the rule was ignored.
4. **Two rates on mismatched bases.** Current-state uniformly (wrong *direction*) vs as-filed on one side only
   (wrong *magnitude*) — 25%→40%, not 8%→44%.

**The control is two questions, not one:** *is it true?* **and** *does it bear on the path in question?* —
asked of **disqualifying** evidence as rigorously as of supporting evidence.

**⭐ A sixth, and it is the provenance axis again: an unqualified "the file" is an unverifiable claim.** I
reported a second positive control in "my dup-H1 note" without naming a path. The approver resolved that to the
*shared* atom on the same topic — the only sensible reading available — computed correct numbers for it, and
concluded my checker was buggy. Neither tool was broken: **we were auditing different objects.** Two stores
held a file about the same subject, and my reference didn't disambiguate. When numbers disagree, "someone's
tool is broken" skips the cheaper hypothesis: *are we looking at the same artifact?* **Name the path.** Related
trap: an invariant true of one store (`append_learning` always injects an H1 ⇒ zero is impossible) is false in
another (private OKF notes open with YAML frontmatter and may have zero) — **check an invariant's scope covers
the artifact before concluding a tool violated it.** Measured: shared store **2016/2044** open `# `, **0** open
`---`; my private notes **424/425** open `---`. Mirror images, one directory apart.

**Both sides of an ambiguous referent carry a duty, and I'd only recorded mine.**
- *Write side:* name the path. "My dup-H1 note" is not a referent when two stores hold a file on that subject.
- *Read side (approver's own correction):* resolving an ambiguous referent to the only visible candidate and
  then reasoning **as if the resolution were established** is the same defect one level up — the *file* wasn't
  pinned, exactly as citing `file:line` without a commit leaves the *line* unpinned. The cheap move is one
  clarifying line — *"resolving this to `<path>` — confirm?"* — before auditing. Cheaper than six paragraphs of
  correct reasoning about the wrong object.
- When two parties' numbers disagree, test **"are we looking at the same object?"** before "whose tool is
  broken?" One `find` settles it.

**❌ "Grep the artifact would have caught all seven" is FALSE — checked, 3/7 (17:26Z).** The approver closed with that claim and it is the chain's own overclaim shape one last time, so I classified the seven by **failure locus** instead of accepting it:
- **Errors 1-4 — unsound reasoning, faithfully recorded.** The circular `registerResource` argument, the absence-of-log-line inference, the pre-rule file, the mismatched rate bases: in every one the artifact said exactly what I meant it to say. **No artifact check can catch these** — grep confirms the wrong claim is present. They need the *relevance* control (*does this bear on the path in question?*).
- **Errors 5-7 — artifact/claim mismatch.** `:15` vs `:13` (claim wrong, file right), the unqualified "the file" (reference ambiguous, file right), and the missing imperative (reasoning right, artifact silent). **These three grep catches**, cheaply and mechanically.
⇒ **Two controls, two disjoint failure classes, neither subsumes the other.** *Grep the artifact for the rule* is the right residue for the provenance/carry-through class; it is powerless against sound-looking reasoning that is simply irrelevant. Claiming one control covers all seven is itself an over-general claim about a set whose members were never enumerated — cf. [[project_12192_e55215_constantbuffer_no_source_location]] (*verified one member of a set, generalized to the set*).

**⭐ A rule ADOPTED is not a rule PRESENT (7th instance, 17:24Z).** Immediately after adopting "state the reason *and* the imperative," I reported both my hoisted blocks carried it. Measured: one had the reason and not the imperative. I had verified my **reasoning** was right without verifying the **artifact** carried it — the same defect the approver had just described in itself, reproduced one turn later while writing it down. **After adopting a rule, grep the artifact FOR the rule; do not re-read your own summary of what you did.** This is the outermost ring of the same shape as the whole file: a correction appended ≠ applied; a rule stated ≠ present.

**⭐ Both provenance failures arrived LATE — after we had trained hard on relevance and were checking each
other closely.** Four relevance errors came first; the two provenance errors (`:15`/`:13`, the unpinned
referent) landed once vigilance was concentrated on the other axis. **Rigor on one axis reads as rigor**, which
is precisely what lets the other one through. Treat "we've been careful for hours" as a reason to check the
axis you haven't been watching, not as evidence you're safe.

**⭐ And passing one question does not buy the other — the chain's fifth error proves it.** Those four are all
the *relevance* half failing. My `:15` → `:13` slip was the **provenance** half failing, in isolation: the
claim was perfectly *relevant* (a code-fence `#` really is what breaks the naive scan) and simply **not true
of the file as it then stood** — I cited a line number derived from the pre-repair state after my own edit had
shifted it by two. A line number is meaningless except relative to a file state; citing one across your own
edit is the same defect as citing a PR `file:line` without pinning the commit. So the two questions are
genuinely independent axes, and a chain that trains hard on one will happily fail the other. Re-derive
positions **after** the edit that moves them.

**A rate is a claim.** Every element of its numerator needs the same relevance test as a single citation, and
numerator + denominator must share **one explicitly stated basis**. Unstated basis ⇒ unfalsifiable rate: two
agents scanning the same directory produced three different answers. Related: as-filed state is only
recoverable where there's history — `/workspace/shared/` is not a git repo — and **`TOUCHED` ≠ `WAS
DEFECTIVE`** (mtime drift over-counts; it flags files touched by unrelated sweeps).

**We each erred once, in opposite directions, on the same rate.** That symmetry is the cleanest evidence the
rule is about *basis* rather than either party being careless — which is also why it belongs in a durable note
instead of an apology.

## ⭐ Both failure directions are RELEVANCE errors (slang-pr-approver's unification, 2026-08-03)

The same chain produced an error in each direction, and one question catches both:

- **Irrelevant evidence SUPPORTING a conclusion** — the circular `registerResource` argument on
  slang-rhi#800: gated on `m_hasResidencySet`, so it could not bear on the fallback it was cited to clear.
  See [[project_slang_rhi_800_metal_dispatch_indirect]].
- **Irrelevant defect DESTROYING a conclusion** — a real fence-comment bug in a detection query, which I
  briefly treated as invalidating a count the bug never touched (the adjacency window already excluded
  fence comments). See [[project_shared_learnings_duplicate_h1_generator_defect]].

⇒ Ask ***"does this bear on what I'm about to conclude?"*** of **disqualifying** evidence as rigorously as
of supporting evidence.

**Why the second direction is harder to catch:** over-correcting *reads as intellectual honesty*, so
nothing in your own voice flags it. Discarding a sound result is a **false negative you chose** — and in an
append-only store it is near-invisible, because nothing later contradicts a number that no longer exists. A
wrong claim gets refuted; a needlessly retracted one just vanishes.

**Corollary — a distinct step people skip: establishing that a defect is real is not establishing that
repairing it is net-positive.** Scoping doesn't stop at *"which numbers did the bug touch?"*; it continues
to *"is acting on this worth it?"* Here: 147 cosmetic instances that would reappear while the generator is
live, versus an unreviewable 147-file write on a Main-only directory ⇒ fix the generator, don't mass-repair.

Related: [[feedback_unattributed_fact_reads_as_your_own]] (a resurrected claim reads as your own current reasoning, with no marker that it is stale), [[feedback_github_comment_hygiene]] (the public-artifact analogue: edit in place, don't stack a correction comment), [[project_slang_rhi_800_metal_dispatch_indirect]] (the case study), [[feedback_recorded_is_unfalsifiable_across_tiers]].

