---
name: feedback_the_errors_that_escape_are_in_the_explanatory_layer_not_the_measurements
description: "Across one 4-agent chain, ~13 published errors: ZERO were wrong raw measurements. Every one was an explanation, generalization, coverage claim, or an ARGUMENT left standing on a replaced premise. Controls are cheap to specify and catch instrument faults; interpretations have only attention. Aim scrutiny there — and when you fix a premise, re-read what it held up."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# Measurements held; every escaping error was in the layer built on top of them

**MEASURED 2026-08-06 across slang#12392 / slangpy#820 / #768 — four agents (me, `slang-triager`,
`slangpy-triager`, `slangpy-fixer`), ~4 hours, ~11 corrections.** `slangpy-fixer` named the pattern in
its close-out and it survives inspection: *"in both directions the errors were explanatory or coverage
claims layered on observations that held."*

## The tally

**Wrong (all interpretation, generalization, or coverage):**

| error | layer |
|---|---|
| "trigger is `[shader("compute")]` specifically" (mine + fixer's original) | generalization from 1 cell of a 2×3 matrix |
| `[CUDAKernel]`-crashes-on-hlsl/spirv (mine) | **fabricated by merging two peers' claims** — in no artifact |
| "guard present ⇒ mechanism impossible" (`slang-triager`) | inference from source about a **Release binary** |
| `:433-436` explains the crash (`slang-triager`) | localization over-generalized past its reachable targets |
| crash is at dispatch, not pipeline creation (fixer, earlier) | phase attribution from a log line |
| "missing null check" (fixer, original) | mechanism prose |
| unremembered comments were a past self-session (`slangpy-triager`) | attribution under a shared identity |
| 3-of-5 artifact list (mine) | coverage |
| "the sweep found 5 instances" (mine, relayed as a win) | **grep hits read as a defect count** — 1 of 5 was a quotation inside a retraction; patching it regressed a correct artifact |
| "`entry-point-uniforms:295-303` is a second crash site, lead with it" (mine) | **two verified facts, false conjunction** — pass reachability read as statement reachability; the function returns at `:249` |
| "the L40S can close D3D12/Metal" (mine) | **offered a peer's capability without verifying it** — that box has no D3D12 and no Metal |
| append suffices (`slangpy-triager`) | remedy chosen without enumerating |
| routed to surface owner not author (mine) | allocation |
| refuting text superseded 69 min earlier (`slang-triager`, mine) | staleness |

**Held, without exception:** the two-file `slangc` repro (3/3 × 3 targets); every control arm; the
symbolized frames; the 2×3 GPU matrix (3/3 per cell); the shipped-binary disassembly; the
`SLANG_ASSERT`→`SLANG_ASSUME` expansion; `entry-point-uniforms.cpp:295-303`'s byte-identical shape; the
`slang-emit.cpp:1284` `default:` coverage; the pass-ordering find.

## ⭐⭐⭐ WHY the asymmetry — CONTROLS ARE CHEAP TO SPECIFY, INTERPRETATIONS AREN'T

**`slangpy-triager`'s amendment, 2026-08-06 15:59Z, and it is better than my "the layer is unguarded"
framing.** The reason isn't that interpretation is intrinsically harder. It is that:

> `correct=True` is a **fixture** someone wrote once. *"Is this a count of matches or defects?"* has no
> fixture — **it only fires if a reader asks.**

⇒ **The instrument layer has AUTOMATION; the interpretation layer has only ATTENTION.** That is why the
four instrument faults in this chain died as faults and the interpretation errors shipped as claims.
Attention is the scarcest resource in the loop and the only thing guarding the layer where the errors
actually are.

⇒ ⭐⭐ **So treat the cheap questions as FIXTURES, not habits** — a pre-publication checklist, run once:

| question | status today |
|---|---|
| *Did a control in this run produce correct data?* | ✅ automated |
| *Does the anomaly survive the fix?* | ⚠️ one re-run, manual |
| *Is this a count of matches or of defects?* | ⚠️ one triage pass, manual |
| *Which axes did I hold fixed?* | ⚠️ free, manual |

**The bottom three are the ones that failed today, and all three are a single question asked before
publishing.**

## ⛔ AND THE TALLY ABOVE IS ITSELF A MATCH COUNT — the rule eats its own summary

I reported *"six of my claims were wrong."* The peer applied rule (1) to it: **the inverted
hlsl/spirv row and the `varying-params` over-generalization were ONE fused error** — a single
uncritical relay of one peer message that propagated two claims — not two independent defects. ⇒ **"How
many errors did I make" is a defect-vs-match question too, and I got it wrong in the direction that
sounds harder on myself.** Self-criticism is not exempt from measurement discipline; an inflated error
count is still a wrong number, and it distorts where the next fix goes.

⚠️ **Unresolvable provenance, worth noting rather than settling: THREE parties claim authorship of the
tag-specificity narrowing** — my own leaf says "I concluded", `slangpy-triager` says *"it was mine to
begin with"*, `slangpy-fixer` lists *"the tag narrowing"* among its own. Under a shared
`nv-slang-bot[bot]` identity this is exactly what cannot be recovered from the artifacts
([[feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github]]). ⭐⭐ **Do not resolve
it by deference in either direction** — conceding authorship you cannot verify is as much a false claim
as taking credit. It changed nothing about the fix; record the collision and move on.

## Why the asymmetry is not that people measure carefully

⭐⭐⭐ **Both layers produced faults at similar rates. The difference is that the measurement layer HAS
INSTRUMENTS and the explanatory layer has none.** Four instrument failures fired in this chain and
**every one was caught before becoming a claim**, each by a control:

- CPU sampler matching its own shell (`utime=0/RSS=3.6MB`) → caught by implausibility + re-run
- `rc=255` on every spirv cell incl. controls → caught by a must-differ control (hlsl rc=0)
- missing slangpy include path killing all 6 arms → caught by the matrix's own breadth
- `login=="nv-slang-bot"` vs `"nv-slang-bot[bot]"`, 0 vs 4 → caught by a positive control

⇒ **Controls are a solved problem here; the interpretation layer is unguarded.** A wrong measurement
trips a control. A wrong *explanation of a right measurement* trips nothing — it looks like insight,
and the correct data sitting next to it lends it credibility.

## How to apply

- ⭐⭐⭐ **Put the scrutiny where the errors are: on every sentence that EXPLAINS, GENERALIZES, or
  CLAIMS COVERAGE.** For each, name the falsifier. "3/3 on cuda/spirv/hlsl" needs no challenge;
  "therefore the trigger is X" needs one.
- ⭐⭐ **The four highest-yield questions, all cheap:** (a) *which single unmeasured cell would flip
  this?* (b) *does this mechanism predict the observed coordinates, or merely permit them?* (c) *is my
  list of affected artifacts recalled or grepped?* (d) ⭐⭐⭐ *is this a count of DEFECTS or a count of
  MATCHES?* — the last one because a grep hit list and a defect list read identically, and **a result
  that flatters your coverage gets celebrated instead of triaged** (I relayed "found 2 more than we
  listed" as a win; one of them was a retraction quoting itself, and patching it caused a regression).
- ⭐⭐ **Scope-NARROWING and coverage claims are the dangerous subclass** — they're acted on by *not
  doing work*, which logs nothing. Prefer over-scoping when the matrix is incomplete.
- ⭐ **A fabricated datapoint is the failure mode to fear most** (my `[CUDAKernel]`-on-hlsl/spirv row):
  it came from *merging two peers' true claims* into a row no artifact contained, and it is invisible to
  every control because there was never a measurement. **Cite the artifact you read, per claim.**
- ⛔⭐⭐ **DON'T LUMP THE FAILURE MODES — the remedy gets mis-aimed.** `slang-triager` refused my
  by-symmetry framing that its errors were the same conjunction shape as mine. It committed that shape
  twice, but its two **escaped** errors were **STALE-ARTIFACT** errors: refuting text the issue had
  already withdrawn, and shipping a sentence a rewrapped line made its string-replacement miss. Both
  reduce to *"I did not re-read the thing I was making a claim about."* **Different failure ⇒ different
  guard:** re-read before contradicting · assert every edit anchor · derive verification needles from
  the **published** body, not the draft. ⭐ *Declining a peer's over-generous account of your own errors
  is the same discipline as declining an over-generous account of your work.*
- ⭐⭐⭐ **The commonest form here was a FALSE CONJUNCTION of TRUE FACTS, not a false fact.** Twice I
  verified both halves at source and the join was wrong: *"identical statements" + "pass runs for these
  targets"* ⇒ reaches those statements (it returns first); *"peer has a GPU" + "these backends need a
  GPU"* ⇒ peer can measure them (no D3D12, no Metal). **Verifying each premise gives no warrant for the
  inference, and it feels like more diligence than a single unchecked claim.** ⇒ after checking the
  premises, state the join as its own claim and ask what would falsify *it*.
- ✅ **This is why the chain converged despite ~11 errors: the load-bearing artifacts were all raw
  observations, and peers verified at source instead of inheriting.** Keep briefings labeled as leads.

## ⛔⭐⭐⭐ THE DEEPEST INSTANCE: A TRUE FACT WITH A STALE CONCLUSION STILL ATTACHED

**Measured 2026-08-06 21:57Z, `slangpy-fixer`, self-caught after I flagged only the adjacent risk.**
Having resolved #12392's null source, it patched slangpy#820's comment `5205485825` to say so — **and
left the paragraph's opening intact.** The result argued *"don't wait for upstream, because their fix
may be large"* immediately beside its own new sentence saying the upstream fix is likely **small**.

⇒ ⭐⭐⭐ **It updated a PREMISE without re-reading the CONCLUSION that premise was holding up.** Every
individual sentence was true and current; the *argument* had silently inverted. **No fact-check catches
this** — fact-checking verifies sentences, and the defect is in the load-bearing relation between them.

✅ **The repair is the model: it re-based the conclusion instead of deleting it.** New footing —
*"SlangPy should not emit a colliding entry point regardless of whether Slang ever crashes on it"* — a
correctness fix in generated code rather than a workaround for someone else's bug, **so it does not
expire when #12392 lands.** ⭐⭐ *A conclusion that survives its premise's death needed different footing
all along; finding it is stronger than the original argument.* Verified at source: the paragraph now
states the update, names what no longer carries weight, and gives the replacement reason.

⇒ ⭐⭐ **OPERATIONAL RULE: when you fix a premise, re-read what it was holding up.** A retraction sweep
greps for the *stale claim*; this defect leaves **no stale claim to grep for**. The only detector is
re-reading the argument end-to-end after the edit.

⚠️ **And it generalizes to a live risk on my own side:** I told `slang-triager` and `slangpy-fixer` the
tag×target asymmetry is "compiler-side". True — and it could be read as retiring slangpy's own fix. I
flagged that explicitly ("compiler-side ≠ nothing to do here"); the fixer then found the *inverse*
version of the same defect already shipped in its own artifact. **The same premise change can invert
arguments in two different documents in opposite directions.**

## ⭐⭐⭐ THE UNIFYING SHAPE: THEY FLATTER THE WORK, SO NOBODY TRIAGES THEM

`slangpy-triager`'s close-out named what the whole chain's escaped errors have in common, and it is
tighter than "the explanatory layer is unguarded". Three of this chain's worst errors:

| the thing | what it flatters |
|---|---|
| a **caveat** aimed at the right claim ("measured on CUDA only") | reads as **diligence** |
| a **count** of grep matches ("found 2 more than we listed") | reads as **coverage** |
| a **harness bug** found late ("`[CUDAKernel]` rejects non-void returns") | reads as an **explanation** |

⇒ **Each occupies the scrutiny slot that re-derivation would have used.** A claim that makes you look
careless gets checked; a claim that makes you look thorough does not. **The flattering result is the one
to triage.**

✅ **Its final triage proves the point one level up.** Classifying the 4 remaining occurrences gave
**1 annotated assertion + 3 correct usages** (one `quoted-to-withdraw`, two `cited-as-history`). *"Had I
read the tally as a defect list, I'd have 'fixed' three artifacts that were already right"* — the same
error we had just closed, recurring at the next level of the same task.

**The four cheap questions, all of which cost one thought:**
1. *Is this a count of DEFECTS or a count of MATCHES?*
2. *Does the anomaly SURVIVE the fix?* (else the trap didn't cause it)
3. *Did a control in this run produce correct data?* (else the rig is the suspect)
4. *Which single unmeasured cell would flip this?*

Related: [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]],
[[feedback_mechanism_must_predict_observed_coordinates]],
[[feedback_a_present_guard_can_be_deleted_by_its_own_preceding_assert]],
[[feedback_a_new_comment_does_not_correct_the_body]],
[[feedback_publish_a_claim_as_wide_as_your_evidence]].
