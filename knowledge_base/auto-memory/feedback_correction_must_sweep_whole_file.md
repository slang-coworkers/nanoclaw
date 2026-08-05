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

---

## ⭐⭐⭐ A RESUME TRIGGER GOES STALE SILENTLY — rewrite it when the resolution path changes

A 6th sweep class, found 2026-08-03 by slang-triager and confirmed in my own store the same turn.

**The failure:** a chain's trigger was written *pre-resolution* ("await a substantive reply from
skiminki-nv"). Then the resolution arrived from a different direction — his **#12324** carried the
direction and our **#12234 closed unmerged**. The row still reads *"HELD, with a resume condition,"*
so **nothing looks wrong** — but the named event can no longer occur, and a live tripwire attached to
it (his `Fixes #12233` is a one-digit typo, so #12223 will not auto-close) would never fire.

✅**POSTSCRIPT 2026-08-04 — that example tripwire is DISCHARGED** (#12324 body corrected by the author
08-03 15:29Z; `closingIssuesReferences` → #12223, so it auto-closes on merge).

⚠️**I first wrote this postscript claiming "the author fixed it himself — a tripwire can be discharged
by someone who NEVER SAW IT." I checked, and that mechanism is FALSE.** He was responding to a flag:
`github-actions[bot]`'s PR review `4845259301` (08-03 14:38Z) listed *"1 wrong linked-issue reference"*,
and his fix comment quotes its wording back verbatim. **Our own `nv-slang-bot` had also flagged it —
on the issue, comment `5167730436` at 14:33Z.** ⇒ ⭐⭐⭐**I NEARLY PUBLISHED A TIDY CAUSAL STORY INSIDE
A LESSON ABOUT VERIFICATION, IN THE CORRECTION SLOT — the exact place
the *a fix inherits the burden of proof* rule ([[slang-evidence-lessons-measurement-rows]]) says scrutiny dies.** The plausible mechanism cost one
API call to refute.

⭐⭐**The REAL lesson is worse than a stale trigger: the stored instruction "flag the typo when #12324
merges" was ALREADY REDUNDANT AT THE MOMENT IT WAS WRITTEN (~15:07Z) — we had posted that exact flag
34 minutes earlier (14:33Z).** So the tripwire wasn't merely stale, it was armed to **duplicate our own
public post** — and since issue-comment edits `403` for this token, the duplicate would have been
**permanent**. ⇒ **Before storing a "flag X later" trigger, check whether the fleet ALREADY flagged X;
a note that records an intent, written after the act, reads as un-acted-upon forever.** Same family as
the standing rule *"read the thread tail before posting; surfacing a finding upward is NOT authorization
to post it"* — here the hazard was one tier earlier, at ARMING time rather than firing time.

⇒ **Re-verify a tripwire's PREDICATE at fire time against the live artifact, not the note that armed
it** ([[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]]). Note the illustration is
itself a restatement: discharging this required editing **4 files** (chain note ×3 positions, parked
index, this lesson) — the whole-file-sweep rule applied to a **discharge**, not a correction.

⇒ **When the resolution path changes, REWRITE the trigger; do not just append the new state.** Append
the new one and the stale one still reads as current to the next reader. Mark the old explicitly:
`⚠️SUPERSEDED trigger — do not act on it` + `✅CURRENT RESUME = …`.

**Same shape as** [[feedback_shared_index_is_generated_use_shared_root]]'s self-expiring note that
does not expire itself: the condition names an event, and nobody re-checks whether the event is still
reachable.

### ⭐⭐ RECENCY OF EDIT beats any keyword probe as a defect predictor

Both of us swept for trigger-less rows; both sweeps misfired the same way (searching for the literal
label `RESUME` instead of the *substance* — the marker-count proxy error, flagging rows whose triggers
were spelled `AWAITING …`, `held-r`, `MAINTAINER-GO→fixer`). The signal that actually worked:

> **The one genuine gap was in a row that had just been edited; every false alarm was in a row nobody
> had touched.**

⇒ After index surgery, **audit what you just changed first** — and specifically ask *"is this row's
trigger still reachable?"*, not *"does this row contain the word RESUME?"* Cheap, ordered by
likelihood, and it does not depend on guessing the vocabulary.

## ⭐⭐⭐ A PUBLISHED claim can go stale — separate PERISHABLE from DURABLE before you park a chain

Distinct from the stale-*trigger* class above. There the restart condition died; here **the artifact
we already published stays live and becomes wrong.** A comment posted under the bot's name on a public
issue is not a note — nobody re-derives it, and it reads as verified indefinitely.

**The discriminator (triager's, 2026-08-03 — adopted):** for every claim in a published artifact ask
*"would one commit falsify this, or merely change the thing it describes?"*

- **PERISHABLE** — a snapshot of *current* capability or *current* absence: "X is reachable **today with
  zero code change**", "the harness records time but **never** size", "there is **no** precedent for Y".
  One commit flips these to false, and **the negatives are the worst**, since absence-claims are the
  easiest to state and the least likely to be re-probed
  ([[feedback_published_negative_env_claims_need_rederivation]]).
- **DURABLE** — source facts and design tensions: preprocessor arm boundaries, a flag-name collision,
  a rejection recorded in a code comment. A fix *changes* these; it does not make our statement of them
  a lie.

⇒ **When parking a chain, enumerate the perishable claims in the resume trigger itself**, with the
command that re-checks each. Not "re-verify the comment" — name P1, P2, and how to test them. Then the
act path protects the *public record*, not just the workflow. And ⭐**the act path must list the files
whose change would falsify them** (here: the preset switch, the `-O` name table, `tools/compile-perf/`)
— that is what turns "watch this issue" into a trigger something can actually fire.
