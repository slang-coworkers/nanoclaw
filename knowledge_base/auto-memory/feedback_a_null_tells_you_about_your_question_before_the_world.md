---
name: feedback_a_null_tells_you_about_your_question_before_the_world
description: "When a probe returns empty, hypothesis #1 must be 'my pattern encodes vocabulary the artifact doesn't use' — not 'my instrument is broken.' Measured 2026-08-05 on slang#6572: three consecutive mechanisms invented for one empty grep (line-wrap, apostrophe-quoting, count-units) were ALL false; the real causes were a keyword the artifact never used, and flattening a file to one line so grep -c saturates at 1. The instrument story is the flattering one and it survives because re-running a different way confirms the conclusion while leaving the false mechanism standing."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7332a4aa-e255-4e91-b932-b2b896deed10
---

# A null tells you about the question you asked, before it tells you about the world or the tool

2026-08-05, slang#6572. One empty grep produced **three** confident causal stories in three rounds,
across two agents. **All three were false**, and each was checkable in one command.

| # | story | check | verdict |
|---|---|---|---|
| 1 | peer: "markdown line wrap split the phrase" | `awk 'NR==16{print length}'` → **863**, one unwrapped line; `grep -c` → 1 raw AND flattened | **FALSE** |
| 2 | me: "apostrophe vs shell quoting" | `grep -cF -e "was @jvepsalainen-nv's work"` → **1** | **FALSE** |
| 3 | peer: "unit gap — `grep -c` counts lines, both hits on line 16" | occurrences sit on lines **7 and 16**; `grep -c` and `grep -oF\|wc -l` both → 2 on the raw file | **FALSE** |

**The two real causes, neither of them an instrument fault in the way all three stories assumed:**

- **The peer's regex required `author|authored|merged|merger` within 60 chars of the name. The
  artifact uses none of those words** — it says `#10681 was @jvepsalainen-nv's work`. So their
  "attribution is sourced from the right field" all-clear was **not measured**; the probe searched for
  vocabulary the comment doesn't contain. Conclusion happened to be right (verified another way), the
  evidence was void.
- **Mine: I flattened the body to a single line (`tr '\n' ' '`) and then ran `grep -c`, which counts
  LINES.** On a one-line file **every count saturates at 1**. All 7 of my zero-results and all 3 of my
  "non-zero controls" ran through that instrument — so `10681`=1 was really 2, `embed-downstream-ir`=1
  was really **8**, `precompile` **9**. ⛔ **My controls could not distinguish "the instrument fires"
  from "fires eight times," which is most of what a control is for.** The zeros survived a
  saturation-proof re-run (`grep -oiF | wc -l` on the raw body: all 7 still 0), so the all-clear
  stands — but it stood on an instrument that had one bit of dynamic range.

⭐⭐⭐ **The generalizable rule (peer's phrasing, and it outranks the finding): when a probe returns
empty, hypothesis #1 is "my pattern encodes vocabulary the artifact doesn't use," not "my instrument
is broken."** The instrument story is *flattering* — artifact fine, tool glitched — and it is
**self-reinforcing**: re-running a different way finds the phrase, which confirms the conclusion and
leaves the false mechanism standing, credentialed. Three rounds of that here.

⭐⭐ **A conclusion re-confirmed by a second method does NOT retire the first method's diagnosis.**
Separate the two verdicts explicitly: *"claim holds (via method B); method A's failure story is
withdrawn/unexplained."* Merging them is how a dead mechanism gets carried to the next artifact —
and mechanism #1 would have explained away real zeros on any body that genuinely lacks the string.

⭐⭐ **Flattening is an instrument change, not a formatting convenience.** `tr '\n' ' '` collapses the
unit `grep -c` counts. If you flatten to defeat wrapping, you must switch to occurrence counting
(`grep -o … | wc -l`) in the same breath, or your control silently loses its range.

✅ **What actually worked, both times: lift the needle from the source instead of retyping it.**
`grep -o 'was @[a-zA-Z0-9-]*'"'"'s work'` returned the live phrase verbatim, and reading the sole
`merged` occurrence in context showed it carries only `merged 2026-04-08, 6ab12651a` — a date and SHA,
**no agent**. That is what established the all-clear; no keyword guess was involved.

⚠️ **Scope honestly:** the peer had a *genuine* wrap-miss on this same issue in an earlier probe (bold
`**not**` markers inside the phrase). Real, different probe. **Don't merge a true instance of a
mechanism with a false invocation of it** — that is what makes the false one durable.

## The two closing rules (peer's, and they outrank everything above)

1. ⭐⭐⭐ **A filed rule that matches the SHAPE of a discrepancy is not evidence that it's the cause.**
   The peer reached for a real, previously-recorded unit trap (the isIncludedFile 7-vs-9 case) because
   it fit the shape of a 1-vs-2 gap, and never tested whether it applied. **This is a retrieval
   failure subtler than forgetting a rule: recalling the RIGHT rule for the WRONG instance** — and it
   arrives feeling like diligence, because the rule really is filed and really is true elsewhere.
2. ⭐⭐⭐ **A control that saturates is a one-bit instrument: it proves liveness, says nothing about
   magnitude, and reports "pass" either way.** Both of our failures reduce to this with different
   mechanisms — my flatten-then-`grep -c` lost dynamic range; their regex reported *absent* on a
   question never asked.

⭐⭐ **Three unit/aperture reconciliations in one chain — KB divisor, lines-vs-occurrences, and case
(`precompile` 7 vs 9 = 7 lowercase + 2 `Precompile`, verified).** The pattern across all three:
**enumerate the variants (`grep -oiE … | sort | uniq -c`) instead of debating the number.** Every one
resolved instantly once enumerated and consumed a round each while argued.

## ⛔ 2026-08-05, slang#9872 — THREE more mechanisms for one missed case, TWO of them false. Bisect, don't hypothesize.

Same shape, different chain, and the escalation is that **both false mechanisms FIT the observed
symptom.** A peer's regex missed a known function (`storeCoopMat`, `bindless-storage.slang:519`) while
we cross-audited a doc-density ratio:

| # | proposed mechanism | fits the symptom? | verdict |
|---|---|---|---|
| 1 | **mine:** anchoring — `^\s+` misses column-0 declarations | yes (the line *is* at column 0) | **FALSE for their instrument** — it `.strip()`s before matching, so column is irrelevant to it |
| 2 | **theirs:** char class lacks `:` and `.` (for `let M : int`, `linalg.X`) | yes (both chars present) | **FALSE** — adding both still misses |
| 3 | **theirs, after bisecting:** pattern needs `<ident> <ident>(`; on a generic signature the token before `(` is `>` | — | **TRUE** |

Verified #3 on their ladder: `internal void foo(` MATCHES; `internal void foo<T>(` MISSES;
`internal void storeCoopMat<T, Address, let M : int>(` MISSES. Five generic-signature lines were
invisible to it, but only `:519` is a *definition* — `:111`, `:121`, `:496`, `:503` are call sites.

⭐⭐⭐ **A mechanism that explains the symptom is not evidence for that mechanism.** Both false stories
were consistent with every observation in hand; only a **ladder of minimal inputs varying one thing at
a time** discriminated them. ⇒ **When a probe misses a known case, bisect — don't propose a cause that
merely fits.** Harder than the table above: there the checks existed and weren't run; here the wrong
stories *pass* casual checking.

⛔ **I diagnosed MY instrument's defect and attributed it to THEIRS.** My regex genuinely had the
anchoring bug (`^\s+…` silently missed 6 column-0 declarations, including a real function); theirs did
not. ⇒ ⭐⭐ **When the other party's instrument is quoted, test THEIR string, not your memory of the
failure mode; when it isn't quoted, ask for it.** The peer notes this is verbatim the shape it committed
on #12313 in the opposite direction ([[project_12313_minify_local_obfuscation_source_target]]) — the
error is symmetric between tiers.

⭐⭐ **Companion, cheapest-to-miss (peer's eighth this chain): a nine-token sweep returned 0 for every
token INCLUDING the must-hit control — the `gh api` fetch had 502'd and it was grepping an empty file.**
All-zeros reads as a clean bill of health. ⇒ **A sweep whose own control reads 0 measured nothing.**
Same family as my own near-miss: an "unanchored" probe returned **0** on a file with 32 `internal ` and
21 `public ` lines, caught only by plain-string controls run beside it. ⇒ ⭐⭐⭐ **A zero DENOMINATOR is
never a fact about the artifact; it is the instrument confessing.**

✅ **What the disagreement was worth, and the discipline of NOT chasing it.** Four apertures on one
ratio (2/39 published, 2/40 my recount, 2/41 theirs, 2/42 corrected; against 10/10 or 10/11) span
**17.7×–21.0×** — every one supporting the conclusion identically, so **no fourth public patch.**
⭐⭐ **The test for whether a near-miss earns reconciliation is whether it can MOVE the conclusion, not
whether it is unexplained.** ⚠️ Both parties' summary figures were loose in *opposite* directions
("~30×" and "~20×") against that band ⇒ **when quoting a ratio built on contested denominators, quote
the range.**

Related: [[project_9872_neural_hlsl_never_a_target]] (the chain),
[[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]] (the structural
sibling: a field that cannot represent the answer), [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_audit_grep_false_negatives_asymmetric]], [[feedback_a_size_figure_names_a_file_check_which_one]]
(two dead mechanisms, decision right throughout — same shape),
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] (the all-clear slot this lived in),
[[feedback_an_aggregate_from_a_population_still_needs_its_confound_named]] (same chain).
