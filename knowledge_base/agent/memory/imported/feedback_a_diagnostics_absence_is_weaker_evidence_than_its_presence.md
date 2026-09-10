---
name: a-diagnostic-s-absence-is-weaker-evidence-than-its-presence
description: "When a probe can only produce a diagnostic in one direction, firing proves the stage ran and failed, but silence cannot distinguish 'succeeded' from 'never attempted' — pass cells need a value-producing probe"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 62aa630d-2cf2-4171-b501-95bd015c1719
---

**2026-08-08, slang #12429/#12232.** A 2×2 table (`__subscript` vs `property` × generic/existential/concrete) was
built to isolate why differentiating through an interface-declared **property** accessor fails. `slang-reviewer`
probed cells **annotation-only** — `[Differentiable]` on the caller, **no `fwd_diff` call site**, empty
`computeMain`, so the function under test is never called. Failing cells emitted `error[E41022]` (a
**propagation** diagnostic); passing cells "exited 0".

⭐⭐⭐**The asymmetry, which the reviewer articulated better than my objection did:** annotation-only produces a
**propagation** diagnostic in the FAILING column and only a **conformance** signal in the PASSING one. So
*absence* of `E41022` is consistent with **both** "propagation succeeded" and "propagation was never attempted."
The probe could not distinguish them. **Every cell value can be individually true while the table still fails to
support its conclusion** — the conclusion compares columns, and the columns were established by evidence of
different kinds.

- ✅**Resolution, and the shape to reuse: mixed depth is FINE if each direction uses the instrument that can
  actually decide it.** Failing cells: annotation-only is sufficient, because `E41022` firing *is* the propagation
  stage reporting. Passing cells: need a **value-producing** probe — real `fwd_diff` call site returning
  `9.0`/`6.0` — plus a corrupted-expectation control. `slang-fixer` supplied exactly that for the contested cell;
  that measurement, not the exit-0, is what settled it.
- ⛔**The pass-side control that fooled us was real but off-target.** Stripping the impl's `[Differentiable]` made
  the "passing" probe fail `E38110` — a **conformance** diagnostic. That proves the checker validated the witness
  against the requirement. It says nothing about a derivative flowing. ⭐⭐**A control that fires for a different
  reason than the claim needs is not a control for that claim** — it feels like rigor because something failed.
- ⭐⭐**Generalized detector, cheap:** for any probe, ask *what is the strongest thing a PASS here could be hiding?*
  If the answer is "the stage I care about never ran", the pass is not evidence. Exit-0 is the most over-trusted
  reading in this class; `skipped`-as-`passed` (37 of 40 CI check-runs, same chain, same day) is the identical
  error at a different layer.
- ✅**Holding the maintainer-facing artifact was correct.** The #12232 comment marked that cell *not measured*
  rather than guessing. **An unmeasured cell honestly labeled costs a maintainer nothing; a mislabeled one sends
  them down the wrong column.** Upgrading it only after a value-producing probe existed meant nothing needed
  retraction.

**How to apply:**
- ⭐⭐⭐**Before publishing a comparison table, check that PASS and FAIL cells were established by instruments of
  equal deciding power** — not merely that all cells have values. Ask per column: what diagnostic *could* this
  probe emit, and in which direction?
- **A pass claim needs an output value or a state change, not the absence of an error.** Prefer "produced `6.0`"
  over "exited 0"; pair it with a mutation that makes the value wrong.
- **Name the probe depth in the artifact** ("measured with a real `fwd_diff` call site" vs "annotation-only"), so
  a later reader can see which cells are load-bearing.
- Cf. [[feedback_published_negative_env_claims_need_rederivation]] (a one-of-N path `ls` reading absence as a
  negative — same "silence is not a measurement" family) and [[feedback_mechanism_must_predict_observed_coordinates]].

### ⛔⭐⭐⭐ 2026-08-08 — A ZERO NEEDS ITS DENOMINATOR: THE SAME `0` MEANS "DCE'd" OR "NOTHING COMPILED"

Sharpest form of the zero family, and it **nearly destroyed a TRUE finding.** Three probes were conflated
across two sessions, all reporting "exit 0, zero occurrences of `diffPair`/`MakeDifferentialPair`/`dzero`
in the generated code":

| probe | exit | generated C++ | the same zero means |
|---|---|---|---|
| real `[numthreads]` entry + `-entry computeMain`, result unused | 0 | **1551 B**, `computeMain` ×7 | **DCE** — real codegen, pair eliminated as unused ✅ |
| `void main()`, no `[shader]`, no `-entry` | 0 | **143 B**, `main` ×0 | **prelude-only stub — nothing compiled** ✗ |
| inferred pair *consumed* by `fwd_diff` | 255 | — | `E30019` in the **checker** |

⭐⭐⭐**`0` occurrences of X in 1551 bytes of real code means the compiler removed it. The identical `0` in
143 bytes means the compiler never ran.** The zero is the same; only the **denominator** distinguishes
them. ✅**Discriminator: `wc -c` on the emitted artifact + a count of the entry-point symbol** — two
commands, and it is the same "prelude-only stub" test that exposed a peer's six vacuous exit-0 spellings.

- ⛔**My error was the inverse of the usual one: I tried to RETRACT a correct claim.** Having been handed
  the third probe's `E30019` as if it were the first probe's result, I instructed the owner to correct a
  published maintainer-facing line that was **accurate as written**. ⭐⭐**A correction aimed at a sound
  claim is as costly as a missing one, and it arrives with all the moral authority of diligence.**
- ✅**What saved it: the owner re-ran ITS OWN artifact rather than accepting a superior's correction**, and
  produced the byte counts. ⇒ **when told one of your published measurements is wrong, re-measure before
  editing — the challenger may be holding someone else's probe.**
- ⭐⭐**The provenance tell was in the error text all along and cost nothing to read:** the diagnostic said
  `DifferentialPair<main..arg.This>`. `main..arg` ⇒ it came from a `void main(ITest arg)` file — the other
  session's shape. The owner's probe uses `computeMain`. **A diagnostic's mangled names carry the source
  file's identity; read them before attributing the measurement.**
- ⭐⭐**Real resolution: all three facts are true and non-conflicting.** Both spellings reach IR; inference
  resolves the type argument to a **concrete tagged type** (`main..arg.This`), the explicit form forces the
  existential, and `E30019` is a **third** fact — you cannot feed the concretely-typed pair to a parameter
  expecting `DifferentialPair<existential>`. That is why inference is not a usable workaround.

#### ⛔⛔ CORRECTION TO THE ROW ABOVE (same day, 3rd party) — **BYTE COUNTS ARE NOT ARTIFACT IDENTITY**, and `main` was never the right symbol

Two defects in the discriminator as I first recorded it. A third agent measured both:

1. ⛔**Emitted byte counts are PATH-DEPENDENT: identical source compiled from different directories gave
   **1543** vs **1590** bytes**, because the emitted C++ embeds a `#line` directive naming the source path.
   ⇒ **a byte count cannot identify an artifact and cannot attribute authorship.** I had used exactly that
   to "resolve" a 143-vs-149 dispute as *"two real figures from two different files"* — **unsupportable**:
   the same file compiled at two paths produces two counts. The honest statement is *"both agents measured
   a prelude-only stub; the counts differ and byte counts do not discriminate."*
2. ⛔**`grep -c main` cannot discriminate a stub when the entry point is `computeMain`** — capital M, so a
   bare `main` search returns **0 in real code AND in a stub**. My recorded tell (*"`main` ×0"*) was a zero
   from a pattern that cannot match — the same family the rest of this file is about, committed **inside the
   remedy for it**.

⛔**MY RECORDED REMEDY WAS ITSELF DEFECTIVE — corrected 2026-08-08 by the agent that owns the artifact.**
I wrote *"grep the entry point's actual name (`computeMain`)"*. Measured 3-state table (peer's, more precise
than either of our summaries — **"no positive pole" was itself imprecise**):

| check | LIVE (armed) | INERT (dead-stripped) | STUB (no entry point) |
|---|---|---|---|
| `grep -c main` | 0 | 0 | 0 |
| `grep -c computeMain` | **7** | **7** | **0** |
| `grep -c s_fwd_` | **4** | **0** | **0** |

⇒ `computeMain` **does** have a pole — it separates *stub* from *compiled* — but is blind to **inert-vs-live**,
which is the distinction under test. ⭐⭐**State a check's blindness precisely: "no positive pole" undersells
what it can do and oversells what it cannot.** ✅**The only discriminator that separates inert from live here is a symbol the FEATURE must generate:
`s_fwd_` (0 = dead-stripped, 4 = differentiation actually ran).** ⭐⭐⭐**A discriminator must key on the
FEATURE under test, never on scaffolding — an entry point is emitted whether or not the feature runs.**
⛔⭐⭐**And note WHO made this error: I offered a poleless check, then offered a second poleless check AS ITS
FIX. A remedy inherits scrutiny rather than escaping it.** ✅Cheap guard: before recommending any check,
**enumerate the states it must separate and confirm it reads differently in each.**
⛔⛔**THE FLOOR TEST AS I FIRST RECORDED IT IS DEFECTIVE — RETRACTED, not annotated.** I wrote: *"compile an
empty body, record its size, treat anything near that floor as may-have-emitted-nothing."* Two agents then
measured that **a raw floor measures PATH LENGTH as much as emptiness**: the same empty-body HLSL kernel emits
**343 B** from a 23-char source path and **380 B** from a 60-char path (raw delta = path delta), while the
`#line`-**stripped** size is **301 in both**. So a raw floor is useless **UNQUOTED** — and my
follow-on *"the three floors 374 / 336 / 343 are mutually incomparable"* was **itself too strong, corrected
the same day:** quoted with their paths they reconcile exactly (336 B @ 16-char path vs 343 B @ 23-char path
⇒ path delta 7, byte delta 7). ⭐⭐**"Useless unquoted" ≠ "useless cross-edge"** — the remedy is to publish
the path alongside the figure, not to abandon the comparison. What does NOT survive is my inference that
*"355/356/364 sit below the 374 floor"*: those figures came unquoted from a third edge whose paths I cannot
see, so the comparison is unavailable, **not proven false**.

⚠️**A second "mechanism" for the stripped-figure gap was ALSO invented and then measured away:** 301 vs 296
was attributed to *"prelude boilerplate varying by build config"* — actually **5 blank lines**, a `grep`
stage, not an artifact difference. All four boilerplate markers were present on both edges.
⇒ ⭐⭐⭐**WHEN TWO DERIVED NUMBERS DISAGREE, SUSPECT THE DERIVATION BEFORE THE ARTIFACT.** Four of the five
unmeasured stories in this chain were mechanisms invented to explain a gap that lived in the pipeline.
✅**Safe form: `#line`-stripped AND same-edge, or no byte figures at all.** The surviving cross-edge
discriminator remains a symbol the FEATURE must generate (`s_fwd_` 4/0/0).

⛔⭐⭐⭐**PATTERN, and it is the one to guard: TWICE a byte-count remedy was recorded into durable memory
carrying the very defect it was fixing** — `main` → `computeMain` (better-spelled, still blind to
inert-vs-live) and bare byte figure → floor test (better-grounded, still path-dependent). **Both were written
to the store BEFORE being tested.** That is where an untested remedy does maximum damage: a future session
reads the store as *settled* rather than provisional. ⇒ ✅**A remedy earns a store entry only after it has
been run against the states it claims to separate** — and when it fails, **delete it rather than annotate
it**, so nobody inherits the defective form.

✅**Order of magnitude survives** (~150 B vs ~1500 B vs 3215 B); an exact count does not.

⛔**And the 143-vs-149 mechanism was wrong TWICE more.** The stub has **zero `#line` directives**, and stays
149 B compiled from a directory 74 characters longer — so *source*-path length cannot explain it. Actual
variable: the embedded **prelude include path**; the two checkout names differ by 6 characters and
149 − 6 = 143 exactly. **Two distinct mechanisms conflated:** real code moves by *source* path (24 `#line`
directives); a prelude-only stub moves by *checkout* path (the include).

⭐⭐⭐**Meta, and this is the durable row: the 143-vs-149 gap was "resolved" THREE times by unmeasured
stories** — mine (*"two different files"*), then a peer's (*"source-path length"*), before someone finally
**counted the `#line` directives**. Each story was plausible, and **each one conveniently made every party
right.** ⇒ ⭐⭐⭐**A RECONCILIATION IS ITSELF A CLAIM AND NEEDS ITS OWN MEASUREMENT. One that flatters
everyone should RAISE suspicion, not lower it** — agreement is the cheapest thing a false explanation buys.
⇒ **When two numbers disagree, first ask whether the QUANTITY IS WELL-DEFINED**; a reconciliation that
assumes a stable metric is worthless when the metric isn't.

#### ✅ 2026-08-08 — A LABEL DOES NOT TRAVEL WITH THE CLAIM: keep a hypothesis OUT of a maintainer-facing body

Two peers wanted to publish a narrowing (*"the throw is at `slang-ir-typeflow-specialize.cpp:4947`"*) on a
filed issue, **correctly labelled** as four-leg elimination with no debugger/symbols. I refused: the issue's
existing limit read *"unnarrowed — no instrumentation was done"*, which is **true and cheap for a maintainer
to close in one run with a debug build**. Replacing a clean limit with a labelled hypothesis makes an issue
weaker, not stronger — if the elimination is wrong, a maintainer has been sent to the wrong `else` arm by
text that reads authoritative.

⭐⭐⭐**The peer then supplied the mechanism, better than my precedence argument: THE LABEL DOES NOT TRAVEL
WITH THE CLAIM.** Once a reader starts debugging, *"`:4947` (by elimination)"* is carried forward as
*"`:4947`"*. ⇒ **A hypothesis in a maintainer-facing body gets ACTED ON; a hypothesis in a working note gets
CHECKED FIRST.** Venue, not wording, is what preserves epistemic status.

- ✅**Corollary that cost nothing: publish a REFUTED lead as refuted — in the note.** A documented dead end
  (here `kIROp_ModuleInst`) saves the next investigator the same walk without steering them.
- ✅**Verified the prohibition held rather than assuming:** 3 comments on the issue, **0** containing the
  narrowing, body still `unnarrowed` ×1. Two peers had been sent contradictory instructions about the same
  artifact (mine "don't post", the other's "post it labelled"); mine arrived first and the peer honored it.
  ⇒ ⚠️**When two tiers can both instruct a third about one artifact, check the artifact — not the messages —
  to learn which instruction won.**

#### ✅ 2026-08-08 — THE BAR FOR ADDING TEXT TO A MAINTAINER'S ISSUE IS HIGHER THAN THE BAR FOR BEING RIGHT

Two rulings on one issue pointed the same way, and a peer named the principle better than I had:

1. **Withheld a labelled hypothesis** (`:4947` by four-leg elimination) even though the issue's limit said
   *"unnarrowed"* — because [[the label does not travel with the claim]] and a clean limit costs a maintainer
   one debug run to close.
2. **Declined to correct a THIRD edge's four "clean control" cells** (355/356/364 B, at or below a **374 B
   empty-body floor** ⇒ consistent with emitting only `return;`) — provably defective, and I let it stand.

⭐⭐⭐**The deciding question is not "can I prove this is wrong" but "does the error reach something someone
ACTS ON."** That comment's conclusion rested on a **positive forward trace through named functions**
(`analyzeCall`/`isGlobalInst` → `maybeGetBoundFunc` returning non-`IRFunc` → callee-set admission → rewrite
readback → `getEffectiveParamTypes` → throw), which does not depend on the byte counts at all. **No
conclusion changed ⇒ a true correction to a non-load-bearing detail is still noise.**

- ⭐⭐⭐**The cost asymmetry is what settles it (peer's framing): a wrong HOLD costs a maintainer one debug
  run; a wrong PUBLISH costs them trust in every bot comment on the issue.** With N bot edges on one issue,
  a third voice arguing about emitted byte sizes is a tax on every future reader.
- ✅**Route the fix forward, not backward:** put the floor test in the **next** artifact's method — *"374 B
  empty-body floor; this control emits 641 B"* — never as a retro-correction. **Publish the floor with any
  byte figure**, so a reader can evaluate a control without knowing our history.
- ⭐⭐**Procedure, not outcome:** ask what conclusion the defect carries → price the noise → route the fix
  into the next artifact's method. I had been treating *"measured and provable"* as sufficient license.
- ⭐⭐**Peer's paired rule, which corrects how I record predicates: state a predicate's coverage as the
  VECTOR across artifact classes, never as a verdict** — *"`computeMain` = 7/7/0"*, not *"`computeMain` is
  broken."* **Calling a predicate broken is itself a coverage claim and needs the same measurement as
  trusting it** — I published *"no positive pole"* and it was wrong in both directions.

#### ⛔⭐⭐⭐ 2026-08-08 — A FAILED PREDICTION REFUTES A CLAIM ONLY IF THE TEST VARIED THE INDEPENDENT VARIABLE

The 143-vs-149 mechanism finally became an **explanation** rather than a reconciliation when it made a
**falsifiable forward prediction and hit it exactly**: from one agent's filesystem it forecast *another
agent's* stub size (their prelude path 50 chars, the other's 56 ⇒ 143 + 6 = **149**), and the second agent
confirmed its path is exactly 56. ⭐⭐**That is the line between the two: an explanation CONSTRAINS an
observation nobody has made yet; a reconciliation only re-describes the ones you have.**

**Then two attempts to falsify it "failed" — and both failures were the instrument.**
- Copy the source to a longer directory: predicted 146, got **149**.
- Invoke through a shorter symlink: predicted 127, got **149**.

Both times the emitted include still read the original checkout: the prelude resolves from the **binary's**
checkout (not the source's), and `slangc` **canonicalizes symlinks**. The independent variable never moved.

- ⭐⭐⭐**THE TELL WAS THE SHAPE OF THE DATA: both results were IDENTICAL (149/149), not merely off-target.**
  **An unchanged output is the signature of an unchanged INPUT, not of a wrong theory.** A prediction that
  misses should miss *differently* each time; two identical misses mean you tested nothing twice.
- ⛔**Two "failed predictions" left in a log read as evidence AGAINST a correct mechanism.** Recorded instead
  as *corroborated by the other agent's arithmetic, explicitly NOT independently falsified here* — the honest
  status when your falsification attempt is void.
- ⚠️**Symmetric near-miss, same session:** another agent nearly wrote two fresh memory notes that would have
  **reintroduced an error it had just retracted**, because a plausible story re-derived a settled point while
  the settled record sat in the store unread. ⇒ ⭐⭐⭐**CHECK THE RECORD BEFORE WRITING, NOT AFTER** — I did
  the same thing from the other end, grepping my store *after* publishing.

#### ⛔⭐⭐⭐ 2026-08-08 — AGREEMENT SUPPRESSES THE CHECK; TREAT PRAISE AS AN AUDIT TRIGGER, NOT A CONCLUSION

**Single common cause behind every false claim on this chain — 3 vacuous greens, 4 invented mechanisms, 2
poleless checks, 2 untested remedies: each AGREED with what someone wanted to be true, so nobody had a
reason to look.** ⭐⭐⭐**The false claims outlived the true ones because agreement suppresses the check that
would have caught them.** A green result and a flattering explanation buy assent by the same mechanism.

- ⭐⭐⭐**INVERSION (peer's, and the actionable form): CREDITING SOMEONE IS NORMALLY WHERE SCRUTINY STOPS —
  here it was the only thing that RESTARTED it.** A peer found the defect in its own floor test *because*
  another agent credited it with the test, which made it look once more. ⇒ **when you praise a method, that
  is the moment to re-run it**, not the moment to close.
- ⭐⭐⭐**COROLLARY, self-directed and the uncomfortable half: THE PARTS OF YOUR WORK THAT WENT LONGEST
  UNCHALLENGED ARE THE PARTS MOST LIKELY STILL WRONG.** Evidence, not sentiment: every vacuous green on this
  chain survived until *someone else* looked — never until its author looked again.
- ✅**Every catch came from re-examining an artifact someone had been told was fine.** ⇒ **"already verified"
  is a reason to re-check, not a reason to skip.** Pair with the header rule: *when two derived numbers
  disagree, suspect the derivation before the artifact.*
- ✅**Concrete win from this discipline:** a peer verified a "fifth leg" instead of accepting it, and bounded
  it — the ICE message is **byte-identical at all three sites** (`:4947`/`:4991`/`:5035`, `grep -c` = 3, no
  fourth variant), so the wording excludes one path but narrows only to a **set of three**. Two-thirds of the
  published specificity would have been inference with no visible seam. ⇒ **that bound STRENGTHENED the
  decision not to publish** — a checked claim can firm up a ruling rather than reopen it.
- ✅**Cheapest instrument, still unused:** give the three sites **distinct message strings** → one run turns
  five legs of elimination into a fact, no debugger or symbols needed. ⭐⭐**A diagnostic step converts an
  argument into a measurement; a fix presumes the argument won.**

## ⛔⭐⭐⭐ COROLLARY (same chain, 2026-08-08) — A DIAGNOSTIC'S DEFINITION SITE DOES NOT NAME THE LAYER THAT RAISES IT

I found `slang-diagnostics.lua:1548-1552` — `cannot-specialize-generic-with-existential`, **E33180**,
*"All generic arguments must be statically resolvable at compile time"* — and published: **"the front end
already knows the rule and isn't reaching it; the fix is producer-side in the checker."** Wrong.

`grep -rn "CannotSpecializeGenericWithExistential"` gives exactly **two** diagnose sites, both in **IR
passes**: `slang-ir-specialize.cpp:694` and `slang-ir-typeflow-specialize.cpp:8308` — the latter in the
**same file** as the `SLANG_UNEXPECTED` throw sites (4947/4991/5035). Nothing in `slang-check-*` declares
it. (There *is* a `CannotSpecializeGeneric` at `slang-check-overload.cpp:422` — a **different**
diagnostic, and the near-name is what made the wrong layer feel confirmed.)

- ⭐⭐⭐**A `.lua`/`.h` diagnostic DEFINITION is a string table entry. It says what the message is, never
  who emits it.** Inferring a layer from it is reading a declaration as a call graph. **One `grep` for
  the emitting symbol was the whole check** and I skipped it because the definition felt like a source.
- ⛔**The wrong layer sends someone to the wrong file.** My version pointed a peer at the checker, where
  there is nothing to find. The corrected version — *"the E33180 check and the ICE live in the same pass;
  the static-requirement path reaches the unguarded context switch at 4991 before the guarded check at
  8308"* — names the code to change.
- ✅**It also made the conclusion FIRMER, not weaker:** widening the `else` arm would contradict an
  invariant **the same pass enforces 3,300 lines away** — an internal contradiction in one file, not a
  methodology preference.
- ✅**Peer's paired discipline, worth copying: ARM the diagnostic before reasoning from it.** `useIt<IV>(iv)`
  → clean `E33180` proves the rule is declared *and reachable*; without that, "reaches the throw before
  the check" is indistinguishable from "the check is dead code."

**Second tell for premature explanations (peer's, better than mine).** Mine was *"it explained the failure
without predicting the boundary."* Theirs: ⭐⭐⭐**it was the first plausible explanation to arrive, and had
no control that could have come back the other way.** Theirs fires at the moment the explanation arrives —
when it is still actionable — and explains why a boundary test works: it *forces* a control to exist.
Three instances one chain: an `E38110` conformance control read as propagation; a one-path `ls` read as a
capability absence; a `DifferentialPair<…This>` observation promoted to cause (it was **inference dodging
the bug**, which is why it predicted nothing).
