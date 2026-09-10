---
name: slang-evidence-lessons-index
description: "The evidence & verification standing lessons — full one-line-per-rule text, moved verbatim out of MEMORY.md. Open BEFORE any verification, correction, or claim of absence. Derivations in slang-evidence-lessons-derivations.md."
metadata: 
  node_type: memory
  type: index
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# Standing lessons — evidence & verification

⛔ **Open this file before verifying anything, correcting anyone, or claiming content is absent.**
Moved verbatim from `MEMORY.md` 2026-08-03 (index was 22.3KB; the section alone was 10.6KB). Rows are
unabridged — the compression pressure that kept truncating them is exactly what these rules warn
about. Proofs: [[slang-evidence-lessons-derivations]].

⛔⭐⭐⭐ **THE ROOT RULE, added 2026-08-04 — [run a control on the INSTRUMENT; re-reading the reasoning cannot find a measurement defect](feedback_control_the_instrument_not_the_reasoning.md).** ⛔**PUBLISH THE ENUMERATION, NEVER A BARE COUNT** — the child holds 17 enumerated + at least 6 more unregistered, and a peer's rival tally (10→13→15→17→18) turned out to be an INCREMENTED TALLY with no list behind it. The load-bearing claim needs no number: **every defect was in the MEASUREMENT; none was findable by re-reading the argument.** The inferences were valid every time; the *measurements* weren't. ⭐⭐⭐**"check your work" and "control your instrument" feel IDENTICAL from the inside, and only the second works.** Holds: **a zero without a non-zero control is not evidence** · **7a can the instrument return non-zero at all?** / **7b can its output carry the claim?** · resolved `committer.login` ≠ free-text `commit.committer.name` (and `web-flow` = server-side) · `git log`/`show` **suppress merge diffs — pass `-m`** · the 9-dimension **containment checklist** · ⭐⭐⭐**confirmation is when verification is cheapest and feels least necessary** · **a ladder of finer numbers is a symptom, not progress** · **an unearned RECOMMENDATION costs someone else's work.** ⇒ **executed as a checklist at the point of claiming, not held as an insight — insight does not survive one message boundary** (each agent committed the shape *while articulating it*).

## The two rules that catch the most, stated as commands

```bash
# EXISTENCE (0/1 only — see caveat): collapse wrap + squeeze indent + literal + case-insensitive
tr '\n' ' ' < FILE | tr -s ' ' | grep -ciF -e 'fragment'
grep -c '' FILE                      # CONTROL — must be non-zero before you believe any zero

# COUNTING is a DIFFERENT command — never reuse the line above for a count
# ⛔ RANGE-PIN IT — an unscoped count decays as the file grows more numbered lists (mine: 20 vs 8)
awk '/^## The .* mechanisms/,/^## Cure/' CHILD | grep -cE '^[0-9]+\. '   # items, one item = one line
grep -oiF -e 'frag' FILE | wc -l      # true occurrences
```
⚠️ **The collapse cure makes the file ONE line, so `-c` can only ever return 0 or 1** — it is a
**presence bit, not a count** (measured: `-ciF 'ladder'` → 1 while true occurrences → 10). Fine for
existence checks; **fatal if you back a count claim with it.** Also: `-c` counts *lines* even with
`-o`, and always pass `-F -e` so a leading-dash token can't error to stderr and read as absence.

Run the ladder — punctuation → `-i` → shorter fragment → collapse+squeeze → synonym/inflection —
**before** claiming absence. A zero without a control is not evidence.

## The rules — split into themed concept pages

The one-line-per-rule detail moved verbatim (2026-09-09) into three linked concept pages so this always-loaded index stays a topic-map, not a fact dump. Open the page matching your task; every row is unabridged and links its full derivation.

- **[Git / clone / CI-state verification](slang-evidence-lessons-git-and-ci.md)** — shallow-clone & branch-ref traps, squash-merge ancestry, `reviews[].commit_id` postdating, green-job/skipped-backend zero-coverage, never-take-state-from-a-narrative-tool, `gh --paginate` 401s, optimized-lane-inert.
- **[Store / corrections / audit-grep](slang-evidence-lessons-store-and-corrections.md)** — correction-sweep & stale resume-triggers, cross-store Mode 7, generated `learnings/INDEX.md`, the audit-grep false-negative / aperture-ladder family, memory read-limit.
- **[Framing / discriminators / instrument-control](slang-evidence-lessons-framing-and-discriminators.md)** — reporter-framing-is-a-hypothesis, mechanism-must-predict-coordinates, narrowing≠testing, published capability-negatives, instrument-inside-the-phenomenon, two-findings-one-filter, replacement-discriminator, unattributed/relayed numbers.

- 📁 **[Evidence-lesson DERIVATIONS](slang-evidence-lessons-derivations.md) — proofs for the starred rules below. Open before restating any upstream; a maxim without evidence gets tidied away.**

- 📁 [Verification-lesson POINTERS](slang-verify-lessons-pointers.md) — reporting discipline (no verdict not in hand · no fabricated events · pushed-state by branch · missing artifact ≠ outage · suspicions = hypotheses · job logs PUBLIC) · the #802 set (3 readers wrong) · verify/CI misc incl. **a tool impeached ⇒ re-derive what leaned on it**

---

📁 **Overflow: [[slang-evidence-lessons-instruments]]** — 4 unabridged rules moved out 2026-08-04 ~~when this file crossed its own 24.4KB read limit~~ ⛔**FALSE PREMISE, corrected in [[project_memory_files_over_read_limit_backlog]]: `>24.4KB` is NOT a read cutoff on this edge.** Discriminating test on record: a **25,264 B** file read **in full** (61/61 lines), and a 321 KB file reads line 298. **This file read COMPLETE at 29,376 B on 08-04, tail line starting at byte 29,030** ⇒ the split bought *navigability*, not readability, and rows past 24.4KB ARE reachable. ⭐**The 17.1KB hook nag, the 24.4KB figure, and an actual truncated read are THREE DIFFERENT QUANTITIES — re-measure before spilling on a byte figure.** Contents: `check-runs?filter=latest` two-suites/currency · **ANY PATH-ADDRESSED FACT is per-container and per-moment** · **TICK-87** unverified-scope · **containment claim needs a containment check**.
