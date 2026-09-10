---
name: feedback_label_dispatch_suspicions_as_hypotheses
description: "A suspicion I embed in a dispatch can steer a coworker to a WRONG TERMINAL disposition (close-as-dup) — label hypotheses as hypotheses, and name the cheap measurement that would settle them"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: edc48ae7-5fee-4ff7-be3f-be0d2948d5d2
---

# Label suspicions in a dispatch as hypotheses, and say how to test them

When dispatching, anything I assert about the technical answer is **read as a prior by the
coworker**, not as an open question. If that prior is wrong AND it points toward a terminal
disposition (duplicate / not-actionable / won't-fix), a competent coworker can execute perfectly and
still bury the real answer.

**Why (#12325, 2026-08-03).** Dispatching the Metal-4 `-std` issue I wrote that passing
`-std=metal4.0` probably "wouldn't help a toolchain that predates metal4.0 ⇒ the headline ask is a
false lead worth saying so politely." **False.** `metal 32023.883` accepts the flag and compiles the
attribute. The triager measured instead of accepting: two CI jobs on the *identical* runner image
with Slang the only variable ⇒ 0 vs **87** Metal tests passing. The reporter's ask was already
implemented (#12009, first release v2026.14) and he was simply on a stale pin — so the true answer
was "bump a version," reachable only by *not* believing me. The triager's own framing of the risk:
had they accepted the premise, they'd have closed #12325 as a duplicate of #12096 and the answer
would have been buried under a confidently-wrong rationale.

Sibling of the #11225 lesson (**a wrong premise supporting a right conclusion is the hardest error
to catch**), but distinct: there the bad premise was in *my own* reasoning; here I *exported* it into
a subordinate's inputs, where it also acquired authority.

**How to apply:**
1. In a dispatch, mark any technical hunch explicitly — "I suspect X; **treat as unverified**" —
   and never pair it with a suggested disposition ("so probably close as dup"). The disposition is
   the coworker's to derive from evidence.
2. Name the **cheap measurement** that would settle it. Here: one same-image A/B varying only the
   dependency version. A hunch with an attached experiment costs one job; a hunch with an attached
   conclusion costs a wrong close.
3. **Before root-causing a user-reported bug, check the reporter's version** — `git tag --contains
   <fix-merge>` converts "fixed on master" into "shipped in vX.Y" and can invert the whole verdict
   from *implement a feature* to *bump a pin*.
4. When a coworker's measurement contradicts me, say so plainly in the report and propagate the
   correction to any **other** issue resting on the same premise (here #12096's "no slang-core
   change is warranted" — flagged rather than left standing contradicted).
5. **Never restate a reporter's CAUSAL claim in my own voice.** They observed a symptom; the
   mechanism is their hypothesis, and it inherits my authority the moment I paraphrase it unmarked.
6. **Don't pre-assert the sizing risk** — say "measure the fallout; that number decides
   small-fix-vs-design-call," not "the risk is source-breaking test fallout."
7. **When a report says "the compiler accepts too much," check the inverse: does the same defect
   REJECT valid code?** That inversion *was* the real bug on #12326 and appeared in neither the
   report nor my framing.

**Second instance (#12326, 2026-08-03).** I told the triager the missing `throw` semicolon
"actually misparses and produces a badly misleading diagnostic" (the reporter's causal claim, in my
voice) and that sizing hinged on "source-breaking fallout." Both fell: greedy expression absorption
is generic to Slang's newline-insensitive grammar — `return` already requires `;` and absorbs the
next line identically — so requiring `;` buys an honest diagnostic, not a tighter bound; and measured
fallout was **1** auto-generated behavior-mirror test out of 18 in-tree `throw` statements. The
finding that mattered was the inverse: the leftover `;` becomes a sibling `EmptyStmt` and orphans a
following `else`, so `if (c) throw e; else …` is **rejected today**. Note the pattern — the one
premise I *did* hedge ("confirm or refute" on the 202c/#12179 independence) held up; the two I
asserted did not. Hedging is what made the difference, not accuracy.
See [[project_12326_throw_statement_missing_semicolon]].

Related: [[feedback_never_relay_a_verdict_not_in_hand]],
[[project_12325_metal4_std_flag_vs_capability]], [[feedback_dont_close_open_proposals]].
