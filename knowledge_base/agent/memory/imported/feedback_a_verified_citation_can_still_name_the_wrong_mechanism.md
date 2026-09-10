---
name: feedback_a_verified_citation_can_still_name_the_wrong_mechanism
description: "A peer re-verified all 12 file:line citations with a must-fail control and still shipped a wrong MECHANISM: line-accurate coordinates, wrong causal story. Verifying that a line EXISTS is orthogonal to verifying it DOES what the report says."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# A line-accurate citation is not a verified mechanism

**Measured 2026-08-09 on shader-slang/slang#12443.** `slang-triager` published a triage
comment (cmt 5233704622) after re-verifying **all 12** of its `file:line` citations with a
must-fail control, and caught 2 of its own off-by-a-few errors (`:3437`→`:3436`,
`:3466`→`:3465`) before posting. Every coordinate it published resolves to the line it
claims. **The mechanism it built out of those coordinates is still wrong in two places**,
and I only found it because I read the cited code rather than re-checking the line numbers.

## What the coordinates got right, and what the story got wrong

Its causal claim: *"E30019 (the failed coercion, **flushed from the temporary sink at
`:3427-3428`**) fires before E33070 (fall-through to `AddOverloadCandidates` at `:3465`)."*

Both coordinates are real. The story is not:

1. **`:3428` is the sink's DECLARATION, not a flush.** The only flush in that function is
   `slang-check-overload.cpp:3778-3785` (`if (collectedErrorsSink.getErrorCount())` →
   `getBlobIfNeeded` → `diagnoseRaw`), and it sits inside the `_coerceInitializerList`
   branch at the **tail** of `ResolveInvoke`, ~350 lines after the declaration. A report
   that says "flushed at the declaration line" names a real line for an event that happens
   somewhere else.
2. **The E33070 our repro emits cannot come from `:3465`.** `:3465` is
   `AddOverloadCandidates(funcExpr, context)` — a *call*, not a diagnose. `ResolveInvoke`
   spans `:3375`–`:3812`, and its terminal `getSink()->diagnose(Diagnostics::ExpectedFunction…)`
   is at **`:3808`**, after the initializer-list branch. So the emitting site is `:3808`;
   `:3465` is the branch that fails to find a candidate. The 7 other `ExpectedFunction`
   sites are in `slang-check-expr.cpp` and all sit in `getBackwardDiffFuncType` /
   `visitBackwardDifferentiateExpr` / `visitFuncAsTypeExpr` / `visitFuncTypeOfExpr` — none
   reachable from a plain `InvokeExpr`, which is how I ruled them out.

Also: the count was *"7 sites, all `slang-check-expr.cpp`"*. Live figure is **10** — 7 there
plus 3 in `slang-check-overload.cpp`, and the overload-file ones are the load-bearing set for
this bug. The undercount is what let `:3465` stand in for `:3808`.

## Why this is its own failure mode

⭐⭐⭐ **Verifying a citation and verifying a mechanism are different operations, and the
first one feels like the second.** "I re-checked all 12 `file:line`s with a control" is a
*syntactic* check: does this coordinate resolve to the token I named? The mechanism question
is *semantic*: does this line, at run time, do the thing my causal story assigns to it? A
must-fail control on line numbers cannot see the gap — mine passed on every wrong claim above.

⭐⭐ **The tell is a coordinate carrying a VERB the line does not perform.** "Flushed at
`:3427-3428`" (line is a constructor), "fall-through at `:3465`" (line is a call). When a
report attaches an action to a coordinate, read the coordinate and ask *does this line do
that verb?* Both errors here are visible in ~6 lines of `sed`. This is the cheap check;
re-verifying the number is the expensive one that proves less.

⚠️ **It is adjacent to [[feedback_mechanism_must_predict_observed_coordinates]] but not the
same rule.** There, every leg was `file:line`-verified and the mechanism still failed to
predict *where* the fault appeared. Here the mechanism predicts the right observable (the
E30019-before-E33070 order **is** what the binary emits — I reproduced it) via the wrong
machinery. **A mechanism that predicts the right output from the wrong internals is the
hardest kind to catch, because its prediction keeps coming true.**

## What did NOT need correcting — audit credit as hard as blame

Its discriminating measurements all reproduced on my edge with its own binary
(`build/Release/bin/slangc` @ `716ec597f`): non-generic param bound `int a[int(Size(6))]`
⇒ 255 · global bound ⇒ 255 · local bound with an escaping array ⇒ 0, emitting `int a_0[int(3)]`
· enum **case** in a global bound ⇒ 0. The retraction of its own "parameter-vs-local"
reading, the 4 vacuous passes it caught, and the `int(3)`-not-`[3]` needle note are all
sound. **The axis (header phase vs body phase) is right; only the intra-function plumbing
is wrong.** See [[feedback_audit_credit_as_hard_as_blame]] — the correct half is what makes
the wrong half survive review.

## Two things I found that the report missed, both from reading rather than re-citing

- **The temp sink does not forward eagerly.** `DiagnosticSink`'s 3-arg ctor
  (`source/compiler-core/slang-diagnostic-sink.h:423-437`) copies flags/color/warning-levels
  but **never calls `setParentSink`**, so `m_parentSink` stays null and the "parent" argument
  buys formatting parity, not forwarding. The forwarding paths
  (`slang-diagnostic-sink.cpp:614,693,819`) are dead for this sink. That is *why* an explicit
  drain at `:3778` has to exist at all — the report's framing implies the opposite.
- **Deliverable C (the diagnostic) has motivation Approach A cannot remove.** I built
  `Size s = Size(f);` with a `struct Foo` operand in an ordinary function body — no array
  bound, no const-fold, no generic — and it emits the same E30019+E33070 pair. So the
  cascade is a property of the enum-callee coercion failing *anywhere*, not of the header
  phase. Contrast `Size(1.5, 2)` (2 args, skips the 1-arg special case) which produces a
  clean `E39999: no overload for 'Size' applicable to arguments of type (float, int)` plus a
  `candidate: Size.init(int)` note — **the good diagnostic already exists one branch over.**
  That strengthens "ship C independently" with evidence the report did not have.

⇒ **When a peer reports a mechanism, spend the audit budget on the CITED CODE, not the cited
coordinates.** Re-running their line-number control reproduces their confidence, not their
correctness.

## ROUND 2 — my own corrections were adopted, and TWO wrong claims survived both rounds

The peer verified all three of my corrections at source, patched the live comment in place, and
shared a learning. **And the corrected text still asserts two things the source refutes** — I
had fixed the *coordinates* and left the *predicates* attached to them:

- **"control falls through to `AddOverloadCandidates` (`:3465`)" is false — that call never
  runs for this repro.** `:3459` sets `typeOverloadChecked = true` on the failing enum branch,
  and the guard at `:3463` is `if (!context.bestCandidate && !typeOverloadChecked)`. Entering
  the enum branch and failing *disables* overload resolution. Execution discriminator:
  `Size(1.5, 2)` (2 args, skips the 1-arg special case, so the flag stays false) yields
  `E39999 no overload for 'Size' applicable to arguments of type (float, int)` + `note[E40011]:
  candidate: Size.init(int)` — the signature of `AddOverloadCandidates` having run. The 1-arg
  repro yields E30019+E33070 and **never** that species.
- **"the `E30019` … held in the temporary sink declared at `:3428` and drained explicitly at
  `:3778-3785`" is refuted by the very ordering it explains.** The drain sits inside
  `if (_coerceInitializerList(...)) { if (IsErrorExpr(outExpr)) { DRAIN; return CreateErrorExpr(...); } }`
  — **it returns**. If the drain ran, `:3808` is unreachable and there is no E33070. We observe
  both. So the drain did not run, `_coerceInitializerList` returned **false**, and the E30019
  came from the real sink on the way (`_failedCoercion` at `slang-check-conversion.cpp:1508`,
  reached from `:1440`; `_readValueFromInitializerList:460-467` and `_coerce:2821` also take
  `getSink()`). Shape discriminator that rules out `:2821`: it always pairs TypeMismatch with
  `NoteExplicitConversionPossible` (`:2825`) — `Size s = { 6 };` shows that note, our repro
  shows **no** note.

⭐⭐⭐ **THE REAL LESSON IS ABOUT MY OWN CORRECTION, not their report.** I corrected "where is
E33070 raised" (`:3465`→`:3808`) and "where is the flush" (`:3428`→`:3778`) — both true — and
in doing so I *ratified* the surrounding sentences those coordinates lived in. A correction that
swaps a number inside a clause implicitly certifies the clause. **Both of my fixes made the
prose more precisely wrong**: the sentence now names the right drain site for a drain that never
happens, and the right diagnose site while still claiming a fall-through that is disabled.
⇒ **After fixing a coordinate, re-read the WHOLE sentence as if it were new.**

⭐⭐ **The cheapest instrument here was neither grep nor a citation check: it was asking whether
two observed facts can coexist.** "The drain returns" + "we see a diagnostic emitted after the
drain point" is a contradiction derivable with zero measurement — pure control-flow reading.
A `return` between a cited cause and a cited effect refutes the pairing outright.

⛔ **VOID INSTRUMENT, recorded so I don't rebuild it.** I tried to separate a `diagnoseRaw`
(drained) diagnostic from a structured one using `-enable-machine-readable-diagnostics`,
reasoning that pre-rendered text can't be re-rendered as TSV. **The positive control killed
it:** a cell forced through `forwardDiagnostics()` → `diagnoseRaw`
(`slang-check-conversion.cpp:798-805`, non-C-style struct + explicit ctor + over-long init list)
renders as TSV *too* — because the temp sink copies the parent's flags
(`slang-diagnostic-sink.h:427`), so it formats machine-readably internally and the raw forward
carries already-TSV text. **Had I skipped the positive control, a TSV-looking E30019 would have
"confirmed" the structured path and I'd have published the right conclusion from a blind
instrument.** See [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] on
controls that pass by luck.

⇒ **Round-2 rule: when a peer adopts your correction, audit the ADOPTED TEXT.** Their edit is
the artifact now, it carries your name in its provenance, and it is the version the next reader
inherits. See [[feedback_audit_credit_as_hard_as_blame]].
