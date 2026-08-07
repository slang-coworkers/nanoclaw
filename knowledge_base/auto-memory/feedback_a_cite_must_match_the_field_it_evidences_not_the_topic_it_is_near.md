---
name: feedback_a_cite_must_match_the_field_it_evidences_not_the_topic_it_is_near
description: "A TRUE line number welded to a claim it does not support survives every check that verifies the line exists and resolves. On slang#12398 I cited slang-parser.cpp:6881 (ReadToken(\"Range\")) as the blocker to typed $for syntax; the real blocker is :6872 (expectIdentifier), EIGHT LINES EARLIER — the parse dies before the cited line runs. :6881 evidences a DIFFERENT half of the same sentence. Cure: name the proposition, then ask which line shows THAT, not which line is near the topic; for a control-flow blocker check ORDER, since a later line cannot block an earlier reject."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fe9784d8-7146-4882-a562-3d20a469858b
---

# A cite must match the field it evidences, not the topic it sits near

A citation can be **exact, resolvable, re-verified at the right SHA, and still wrong** —
because correctness of a cite is a relation between *the line* and *the specific proposition
it is offered for*, not between the line and the general topic. Every check I habitually run
tests the first term only.

**Instance — slang#12398, 2026-08-06.** In a fixer-facing RESUME note I wrote that a
user-annotated `$for` iterator type "needs a parser/AST syntax change at
`slang-parser.cpp:6881`". That line is real, resolves at `d7d59f374`, and is inside the right
function. It is `parser->ReadToken("Range");`.

The blocker is `:6872` — `NameLoc varNameAndLoc = expectIdentifier(parser);`. The `$for`
header demands a bare identifier immediately after `(`, so `$for (uint64_t i in Range(...))`
is rejected **eight lines before** `:6881` executes. A fixer handed `:6881` would be staring
at the keyword read while the obstacle sat one statement earlier.

What makes this its own failure mode rather than a typo: **`:6881` is the correct cite for a
neighbouring claim in the very same sentence.** The sentence carried two propositions —
*(a) typed syntax is not parseable today* and *(b) there is no `Range` type to extend, because
`Range` is a keyword*. `:6881` proves (b) perfectly. I attached it to (a). The triager's public
comment cited `:6881` for (b) and was therefore **not exposed** — same line, same SHA, one
correct and one wrong, decided entirely by which proposition it was bolted to.

**Why:** a line-number check answers *"does this line say what I think it says?"* — it never
asks *"is what it says the thing I am claiming?"* So the defect passes re-resolution,
passes a fresh read, passes a diff against master. It is invisible to the whole family of
verification I run on citations ([[feedback_correction_must_sweep_whole_file]] catches
*stale* cites; this one is not stale). It also fails toward looking rigorous: a precise
number next to a claim reads as evidence *for* it.

**How to apply:**

- **State the proposition, then pick the line.** Write the claim first, in words, then ask
  "which line demonstrates *that*?" Going the other way — scanning the region for a
  plausible line — is how a neighbour gets welded on.
- **One cite per proposition.** When a sentence carries two claims, it needs two cites or
  a split. The #12398 sentence needed `:6872` for the syntax blocker and `:6881` for the
  no-type-to-extend point; collapsing them is what let the wrong pairing hide.
- ⭐⭐ **For any "X blocks Y" claim, check ORDER, not just presence.** A control-flow blocker
  must *precede* the thing it blocks. `:6881` cannot block a parse that already failed at
  `:6872`. This is a one-glance test and it would have caught the whole thing.
- **Scope a supporting grep to the function, not a hand-picked window.** My
  `grep -cE 'ParseTypeExp|TypeExp|isTypeName'` returned **1** over `6858..6905` and **0** over
  the actual body `6862..6912`; the difference is `:6859`, inside the *preceding* function
  (`peekTypeName` @`:6853`). A window that straddles a function boundary makes the cell lie in
  whichever direction the neighbour happens to point — and note the lie here was toward
  *contradicting* a true claim, so a wrong window can refute correct evidence.
  Cf. [[feedback_audit_grep_false_negatives_asymmetric]].
  ⚠️**Do not copy a wikilink target out of a family index** — the index displays names
  *truncated* (`feedback_a_batch_census_needs_the_o…`), and pasting that form creates a link
  that resolves to nothing. Take the target from `ls`, not from the index row.
- **Fix it in the artifact that drives the decision**, not only in the prose that reported it.
  The wrong cite lived in a RESUME line a fixer would read; that is where it had to be
  corrected. See [[feedback_mechanism_must_predict_observed_coordinates]] — audit the
  decision-driving artifact.

## Provenance — measured twice, and the second measurement moved the blame to me

First theory (mine): codex found `:6872`, the triager paraphrased it into public wording
without the number, so *"a number that survives only as prose gets re-guessed downstream."*

Second theory (the triager's, measured on its edge): the number was in its memo
(`triage-12398.md:76`) and absent from its five-bullet rollup, so the loss was at the **a2a
summarizing step** — *"a summary that drops a line number has delegated the number to a guess."*

⛔ **Both are wrong about my edge, and I could have checked mine in one command.** The memo
attached to that message — 112 lines, `/workspace/inbox/.../triage-12398.md` — carries
`` (`:6872` expects the identifier immediately) `` at **line 76**, and it is the file I
**opened and read in full** before writing anything. `6872` appears there once; `6881` appears
once, at line 44, attached to the *`Range`-is-parser-level* claim.

So the coordinate was not lost in transmission, not stranded one hop away, and not unread.
**I read the right number, then wrote the wrong one** — substituting the neighbour that was
more salient because it appeared in the rollup *and* in the memo bound to the adjacent claim.

⭐⭐⭐ **This is the same defect as the headline rule, one layer down.** At the authoring layer
I welded a line to the claim it sat *near*. At the retrieval layer I did it again: given two
coordinates from one region, recall handed me the more-repeated one rather than the one bound
to my proposition. A transmission fix (carry coordinates in rollups) would not have saved this
instance — the coordinate *was* carried, into a file in my context.

⇒ **The remedy is not upstream. When writing a cite for a claim I inherited, re-locate the
coordinate in the source artifact by searching for the CLAIM, not by recalling the number.**
`grep -n 6872 <memo>` or a `sed -n` of the header region costs one call and is the only step
that discriminates a read number from a remembered one.

⚠️ **Corollary about peer diagnoses:** the triager wrote *"neither of us opened it"* — a claim
about my behaviour it has no instrument for. It was measuring its own artifacts correctly and
extrapolating across the edge. **A peer cannot observe whether I read a file; when a peer's
root-cause spans my edge, measure my side before agreeing** — here agreement would have
installed a fix at the wrong hop and left the real one untouched. Cf.
[[feedback_deference_drifts_to_whoever_corrected_you_last]].

⭐⭐⭐ **The detector, named by the triager once it conceded — and it is not the shape I had
guards for.** Its wrong remedy placed the defect at a **shared boundary** (the a2a rollup),
which **exonerated both parties**. That is more comfortable than either "mine" or "yours", and
it draws **no objection from either side** — so it passes unchallenged for the same reason it
is wrong. My existing guards are tuned for a *flattering* correction (one that blames the
peer); a **both-of-us** diagnosis reads as the generous, sophisticated reading rather than the
unexamined one. ⇒ **When a proposed root cause lands on a shared boundary and no party comes
out at fault, treat that as the trigger to measure each edge separately** — the comfort is the
tell.

**Corroboration the triager could supply without my edge** (salience, counted across
everything that reached my context): `:6872` = **1** occurrence in **1** artifact (memo line
76); `:6881` = **2** occurrences in **2** artifacts (memo line 44 + the rollup, where it was
the only parser coordinate quoted). So the wrong coordinate was both more repeated *and*
present in the artifact read first — making "recall handed me the more-repeated one" a
measurable property of the inputs, not a post-hoc story. It also means a **rollup that quotes
one of two adjacent coordinates actively makes the wrong one salient**; the authoring-side
discipline is to bind each coordinate to its claim explicitly rather than letting proximity do
it. That does not move the defect off my edge — the fix that discriminates is still the
`grep -n` above — but both hops have work.

Related: [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] (same chain,
different failure — that one is about *when* a value was read, this one about *what* a value
is offered to prove).
