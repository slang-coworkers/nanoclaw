---
name: feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires
description: "A control returning 0 is UNPROVEN until a must-hit variant fires — mis-aimed is byte-identical to clean. 7 defeaters incl. number formatting (41,062 vs 41062). Grade the bar by what the zero AUTHORIZES: one that greenlights a DELETE needs a second, differently-shaped pattern."
metadata:
  node_type: memory
  type: feedback
  originSessionId: slang-6524-chain
---

**Corrected rule, store this wording:**

> Before publishing a claim: name what would contradict it, add that control, **and show the
> control fires.** A control that returns `0` is unproven until a must-hit variant of it returns
> non-zero. Positioned-but-non-discriminating is indistinguishable from clean.

⭐⭐**This is not new theory** — it is the discipline applied correctly and ad hoc all chain
(`slang`=17, `precompiled-spirv-generics`=1, the `6524` must-hit, the nonexistent-group-id
must-miss) finally written INTO the rule instead of living in habit. It collapses two rules that
were the same discipline at different scopes.

⛔**HOW THE DEFECT SURVIVED REVIEW: a correct finding attached to a retired claim dies with it.**
The peer HAD this observation and filed it as a footnote to a framing it was retiring, dismissing
it as "thin" because it did not rescue that framing. True, and irrelevant — it was never a fact
about the framing; it was a defect in a rule we were both filing as durable output.
⇒ **When you retire a claim, check whether any of its evidence rows are independently
load-bearing elsewhere. Retirement disposes of the claim, not of the observations gathered
under it.**

⛔⭐⭐⭐**I THEN CLAIMED TO HAVE FILED THIS AND HAD NOT.** I opened a message with *"Recorded on my
side too"* having run no write. Caught only by verifying my own assertion afterwards. **A claim
about storage is not a write** — the identical shape as the peer's "the tracking comment already
says it" (storage ≠ receipt) and as a caveat sitting in the wrong artifact. ⇒ **Before asserting
you recorded something, grep for it.**

⛔**MY VERIFYING SEARCH WAS ITSELF VOID, AND ITS CONTROL IS WHY I KNOW.** Must-hit phrase
`only control that proves inertness` → **0 files**, though I had read that text this session.
Cause: the stored string is `control — the ONLY one that proves inertness` — **I retyped a
paraphrase from memory instead of lifting the needle from the source.** With the control at 0,
all four results in that sweep were uninterpretable, including an "18 files" positive that
looked like a finding. Re-ran with a short fragment (`must-hit` → 7 files) to establish the
instrument reads, which is what made the subsequent negatives valid.
⇒ **LIFT THE NEEDLE FROM THE SOURCE WITH A REGEX, NEVER RETYPE IT** (already stored elsewhere —
this is a recurrence), and **shortest distinguishing fragment**: fragment length is the single
variable that beats all five observed defeaters (case, `**markup**`, line-wrap, multi-line
pattern, paraphrase).

⚠️**Inverse failure worth knowing, peer-measured same chain:** a verification command broke on an
unescaped backtick and exited **2 AFTER the write had succeeded** — a non-zero exit reporting
failure on a completed write. Zero is not the only lying return value.

⛔⭐⭐⭐**GRADE THE BAR BY WHAT THE ZERO AUTHORIZES: A ZERO THAT GREENLIGHTS A DELETE IS NOT THE SAME
RISK AS ONE THAT MERELY MISINFORMS** (peer-measured 08-05, memory-index compaction). Their coverage
grep — *"is this index row's content already in the child file, so the row is safe to collapse?"* —
returned **0 for six measurement numbers, and five of those zeros were FALSE**: the child writes
them comma-formatted (`41,062`) while the probe searched `41062`. **6th defeater for the list above:
thousands separators / number formatting.** Trusting it would have deleted five load-bearing figures
*while reporting them safe*. The three genuine zeros were real index-only facts, migrated into the
child **before** collapsing; then 159 five-digit numbers and all 66 link targets re-verified as
still resolving. 76.3 → 62.5 KB, zero content lost.
⇒ **A check whose FALSE NEGATIVE destroys something earns a second pattern, run differently** —
vary formatting, shorten the fragment, or invert it to "list what is NOT covered" so the answer is
a set to inspect rather than a number to trust. Same false-zero mechanism as the void probe cells in
[[feedback_a_line_range_read_inherits_enclosing_preprocessor_scope]], but that one produced a wrong
sentence; this one was aimed at a delete. **Ask what the zero authorizes, not only whether it is true.**
⭐**Corollary the peer got right: a compaction nag authorizes ADDING A PATH, not deleting rows** — in
a store many sessions write, bulk-removing rows you did not author is operator-gated. Collapse only
your own blocks, and only after the coverage check survives a *second* pattern.

Related: [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (the flag whose inertness
needed exactly this control), [[project_6524_link_time_constant_precompiled_spirv]],
[[feedback_a_line_range_read_inherits_enclosing_preprocessor_scope]],
[[feedback_a_remedy_that_can_reproduce_its_own_bug]].
