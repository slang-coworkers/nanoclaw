---
name: feedback_sweep_a_correction_by_instrument_and_inference
description: "Sweeping a correction by POSITION is not enough. Two orthogonal axes: INSTRUMENT — the unit of contamination is the tool, so re-audit every number the broken instrument produced, not just the challenged sentence, and cover the numberless forms (a unit word, a paraphrase, a RUNNABLE RECIPE carry the error past any figure grep — sweep code blocks first, keep verbatim quotes). INFERENCE — a correct measurement camouflages a wrong conclusion; grep the connectives and re-derive; two instruments that degenerate to the same wrong thing are not corroboration; enumerate the mechanisms before concluding absence. Split from [[feedback_correction_unapplied_until_every_restatement_fixed]] 2026-09-23."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# Sweep a correction by INSTRUMENT and INFERENCE, not just by claim

Split 2026-09-23 from [[feedback_correction_unapplied_until_every_restatement_fixed]] (the POSITION axis
and the enumerate-don't-recall mechanism). **Three orthogonal axes, run all three:** ① POSITION (where the
claim sits — the sibling file) · ② INSTRUMENT (what measured it, in every form) · ③ INFERENCE (what was
concluded FROM a correct measurement). These two are the ones a positional sweep silently misses.

## ② INSTRUMENT — the unit of contamination is the tool, not the sentence
The file that holds the positional rule still failed to catch a same-day recurrence, because its sweep
axes are all about *where the claim sits*, never *what measured it*. #11616: I retracted a "33 workflow
files pushed" clause and **left `10 files/+296/−22` attached to the same push SHA in the sentence I had
just edited** — both numbers came from the same wrong endpoint (`pulls/N/files`, cumulative) read as a
fact about a commit. slang-triager independently hit the identical figure-on-a-SHA in its own memo the
same afternoon.
- ⭐⭐⭐ **When you retract an instrument error, re-audit EVERY number in the same sentence — then every
  number anywhere that came from that instrument.** The contamination unit is the instrument, not the
  sentence, and not the sentence you were challenged on.
- ⭐⭐ **The challenged clause is the least likely to be the only one wrong**, because whatever produced it
  was probably used more than once, in one sitting, on the same artifact.
- ⭐⭐ **Scope a correction to the defect CLASS, not the fixed INSTANCE** (two agents reached this from
  different directions — the signal it sits at the right altitude).

### The FORM that drops the measurement — sweep code blocks first
Swept by instrument for the *figures* (372/373, 5222/5223) and still missed restatements carrying the
same error **with no number in them at all**: a table row asserting *"it is **chars**, not bytes"* and a
comment on a runnable command. The numberless form survives, because every natural sweep pattern contains
a number.
- ⭐⭐⭐ **Enumerate the FORMS a claim takes, not just its values:** the number · the unit word · a
  paraphrase · a **runnable command or recipe** · a table cell · a `description`/frontmatter line.
- ⛔⭐⭐ **A RUNNABLE RECIPE is the worst place for a stale unit** — a reader copies the command and inherits
  the wrong instrument silently (mine measured `len(str)` codepoints against a `.length` UTF-16 budget).
  **Prose misleads one reader; a recipe propagates.** Sweep code blocks FIRST, and re-derive what they
  compute rather than reading what they claim.
- ✅ **Keep VERBATIM SOURCE QUOTES unchanged** (`MEMORY_FILE_BUDGET_CHARS = 16_000` is what the code says,
  misleading name and all) — annotate beside them; never "fix" a quotation. Distinguish *the code's
  wording* from *your assertion about it* before editing.
- ⭐⭐ **Sweep PRECISION matters as much as sweep axis.** A bare `\b373\b` over a store dense with SHAs /
  session IDs / issue numbers returned 10 hits, 9 spurious — acting on it would have "corrected" an
  `originSessionId`. An over-broad pattern manufactures work that looks like diligence; filter to the
  claim's context, then ladder each hit.

## ③ INFERENCE — a correct measurement camouflages a wrong conclusion
The hit that survived every other axis: a note reading *"`wc -m` == `wc -c` (21,774), so no UTF-8
multi-byte gap despite the emoji density."* No stale figure, no stale unit word — the measurement is
correct and reproduces. Only the *conclusion* is false (`wc -m` silently counts bytes when the locale is
unset, so the equality is evidence about the LOCALE, not the file). Position sweeps, instrument sweeps,
and figure greps all clear it.
- ⭐⭐⭐ **Two instruments agreeing is NOT corroboration when both degenerate to the same wrong thing.**
  `wc -m == wc -c` *was the tell* and I read it as reassurance — agreement feels like corroboration,
  which makes it worse than a single suspect instrument. Before treating agreement as evidence, ask
  **"could these two disagree, in principle, on this input?"** If not, they are one instrument.
- ⭐⭐ **To sweep inferences, grep the CONNECTIVES, not the values:** `so `, `therefore`, `⇒`, `which
  means`, `hence`, `confirms`. Then re-derive the conclusion from the (correct) number.
- ⭐⭐ **A correct measurement is the best possible camouflage for a wrong conclusion** — nothing in the
  sentence is falsifiable by re-measuring, which is why every measurement-shaped sweep clears it.

### A COMPLETE negative about ONE mechanism is not a negative about the WORLD
The sharpest inference-axis instance landed on the file that introduced the axis, hours later. We
established (correctly) that the SessionStart hook reads only `memory/{index.md,system/definition.md}`,
that `MEMORY.md` appears nowhere in `/app/src`, and that no hook injects it — then concluded *"therefore
`MEMORY.md` is not injected."* **False:** `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0` enables Claude Code native
auto-memory, and `MEMORY.md` was in the system prompt the whole session, labelled "user's auto-memory."
- ⭐⭐⭐ **A negative that is COMPLETE within one mechanism reads exactly like a negative about the world.**
  The search was exhaustive over `/app/src` and the hook config — genuinely zero hits. The defect was the
  unstated premise that this mechanism was the only one.
- ⭐⭐⭐ **ENUMERATE THE MECHANISMS BEFORE CONCLUDING ABSENCE**, then ask what would make the enumeration
  complete. "I read the loader" answers *which files THAT loader reads*, never *which loaders exist*.
- ⭐⭐ **Check what you were GIVEN before searching for what you were given** — the disconfirming evidence (a
  system-prompt label) sat in my own context window, unexamined, for the whole session, and outranks any
  inference from a code search.
- ⭐⭐ **The blast radius of a wrong premise is every artifact built on it** — this one had already voided a
  canary and told the operator its compaction pressure was illusory; the correction swept a title, two
  descriptions, an index row, a canary note and two banners.
- ✅ **Scope a negative to the mechanism you tested** ("*that* hook does not read `MEMORY.md`") and it
  stays true forever.

Related: [[feedback_correction_unapplied_until_every_restatement_fixed]] (POSITION axis + mechanism),
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_optimized_lane_can_be_inert_for_the_fix]] (a zero from an uncontrolled detector, applied to a
probe rather than to prose).
