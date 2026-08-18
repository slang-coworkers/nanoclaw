---
title: "Verifying Code Claims: Reachability, Vacuous Tests, and Reading the Construct"
type: concept
group: general
tags: [testing, verification, reachability, guards, tests, grep, compiler, discriminator]
source_count: 16
---

## TL;DR

Verifying claims *about code* — that a branch is reachable, that a test tests what it claims,
that a guard fires, that an API does what its name suggests. The connective tissue across all
of them: **an artifact that looks identical whether or not it did its job carries no
information**, and the fix is a *discriminating variant* — change the thing you claim is
load-bearing and require the outcome to change.

- **Never infer a defensive branch's reachability from your own code's shape — trace the
  producer.** "It's defensive, so something must reach it" is the absence of evidence.
- **The vacuous-assertion family**: a `CHECK-NOT` that accepts any constant, a control that
  never ran the path, a fatal diagnostic truncating a multi-case file, a false "can't be
  tested" caveat. Ask: *what would have to break for this to fail?*
- **A test that passes for the wrong reason certifies rather than fails to test** — mutation
  testing does NOT catch it; a *discriminating variant* does.
- **A skip condition must key on the DEPENDENCY, never on the SYMPTOM** — and a skip's
  negative control must include "precondition present but subject broken."
- **Key a guard on state you can read, not on a message you hope exists.**
- **A grep that finds a symbol verifies the symbol, not the line number attached to it**;
  a macro-generated API and multi-line calls are invisible to grep.
- **A name that doesn't resolve is free; a name that resolves to something weaker than you
  assumed is the expensive one** — read the construct before claiming its guarantee.

## Trace the producer, not the consumer

**Never infer a defensive branch's reachability from the shape of your own consumer.** A
guard `if (kind != Struct) return;` was defended as "non-Struct is reachable — either call
site could pass one," reasoning from *two call sites ⇒ two things could arrive*; two
reviewers said unreachable, and tracing the *producer* (both call sites always got a
`StructTypeLayout` verbatim) settled it in three lines. **The structure of the consumer tells
you nothing about the set of shapes the producer emits** — follow the value back to where it
is *constructed*, check every producer path including ones you didn't write, and the best
confirmation is an assert-plus-suite (convert the guard to an assert, build debug, run
everything; byte-identical output with no assert firing proves the branch dead). When you're
the only party asserting a fact, re-derive before defending — authorship of the code is not
authority over what reaches it. [Never infer a defensive branch's reachability from your own code's shape — trace the producer](../learnings/1786128499879-never-infer-a-defensive-branch-s-reachability-from.md)

## The vacuous-assertion family and the wrong-reason pass

One fix produced **four** shapes of a test that ran, passed, and asserted nothing: (1) a
`CHECK-NOT` that would pass equally on the wrong constant (a `-NOT` pins absence, never
correctness); (2) a control that never ran the code path (the pass early-outs); (3) a
*fatal* diagnostic silently truncating a multi-case file to the first case; (4) a false
"this can't be tested" caveat that *retires the reviewer's question* — candour is
load-bearing, so a wrong claim about your own coverage protects the gap *better than silence*.
The generalizable check: **for any passing test, ask what would have to break for it to fail;
if you can't name a concrete mutation, it asserts nothing.** Mutation-test with an instrument
control (confirm the break is in the rebuilt binary), prove the instrument fires before
reading silence as data, observe both poles, and pin *values* not just shapes. All five are
one rule: an artifact that looks identical whether or not it did its job carries no
information. [The vacuous-assertion family: four shapes of a test that ran, passed, and asserted nothing about the thing at issue](../learnings/1786211916639-the-vacuous-assertion-family-four-shapes-of-a-test.md)

The worst member, and the only one that survived every routine check: **a test that passes
for the wrong reason certifies rather than fails to test.** A regression test claimed to
cover an interface-typed path; it passed, the diagnostic fired at the right line — but it
reached the diagnostic through the *same path as its sibling* (its `Impl` was itself an empty
struct), and existential legalization was *disabled outright* on the target used. **Mutation
testing does NOT catch this** — the test failed correctly when the diagnostic was broken,
because it *was* testing the diagnostic, just not via the claimed path. What catches it: a
**discriminating variant** — change the thing you claim is load-bearing (add a data member to
`Impl`) and require the outcome to change. If varying your stated cause leaves the result
identical, your stated cause is not the cause. Cheap upstream check too: verify the code path
you claim runs at all on your target (one grep for its enable gate). And: don't rescue an
unsupported clause with a second test — delete the clause; a test kept alive by another test
is a claim looking for support. Attribution errors are symmetric — an over-accepted share of
blame is the same class as an over-claimed share of credit. [A test that passes for the wrong reason certifies rather than fails to test — use a discriminating variant to catch it](../learnings/1786215878160-a-test-that-passes-for-the-wrong-reason-certifies-.md)

## Skips and guards

**A skip condition must key on the DEPENDENCY, never on the SYMPTOM** — because "precondition
absent" and "the thing under test broke" frequently produce the *same observable*, and keying
on it deletes exactly the coverage the test provides. A SPIR-V-linker-generator-id test failed
on Windows because the link block skips when `slang-glslang` can't load. Two successive wrong
guards: keyed on a diagnostic never emitted (`E00100` — the loader deliberately doesn't
diagnose, because it probes multiple library names), then keyed on the symptom (tool-40
generator id — *also exactly what a regression looks like*). The fix asks the dependency
(`checkPassThroughSupport` does a real load attempt). **A skip's negative control must include
"precondition present but subject broken," not just "precondition absent"** — only that third
cell distinguishes the two guards. [A skip condition must key on the DEPENDENCY, never on the SYMPTOM — and an authorship search that can't see your own sent messages will hand credit the wrong way](../learnings/1786189407746-a-skip-condition-must-key-on-the-dependency-never-.md)

The same fix, framed around guard shape: **key a guard on state you can read, not on a message
you hope exists** — "this failure surely reports itself" is among the least-checked
assumptions, because it feels like a property of failure rather than a decision someone made.
Probe the diagnostic on the exact path before keying on it. And **a skip can silently delete
coverage, so it needs its negative control most** — "the test passes now" is indistinguishable
from "the test no longer tests anything," both green; the load-bearing cell is
`guard removed + module absent → EXIT=1`. The honest form of "fixed": a correct skip and an
unfixed environment produce the same green, so report "the test no longer misreports; the
platform is still uncovered." A nit dismissed as covering an unreachable config is exactly the
nit to re-check when a platform's results are *absent* rather than passing. [Don't key a guard on a diagnostic you assume is emitted — and a skip needs a negative control more than an ordinary fix does](../learnings/1786184707221-don-t-key-a-guard-on-a-diagnostic-you-assume-is-em.md)

**Derive latch/guard fields from the DECISIONS the latch feeds, not from "what could this
object do next."** A per-PR state row with nine cells (head sha, isDraft, mergedAt, …) didn't
move a byte when the PR acquired two failing CI checks — none of the nine is a check-run
field. Object-first enumeration yields a plausible list that is silently partial;
decision-first is closed (enumerate the decisions, ask what input each consumes, verify every
watched object supplies it), and **then run the same audit on the fix** — three consecutive
widenings went unaudited. Sub-lessons: a *count* is not the field, the *names* are (a
failing-check count stayed 2→2 through the event); a scheduled guard's *prompt* is as much a
latch as its script, and a stale fact written as an instruction doesn't merely mislead, it
*forbids* the correct action ("0 real failures — DO NOT DISPATCH"); "N jobs skipped" is the
*absence* of the measurement, not a weaker green; and one census, one implementation (hoist
the shared check into a function and delete the inline copy). [A state row carries only the fields you asked of it](../learnings/1786184514952-a-state-row-carries-only-the-fields-you-asked-of-i.md)

## A grep finds a symbol, not the number attached to it

**`grep -n` succeeding tells you the symbol exists; it does not verify the integer you
attached to it.** A public issue cited build guards at `:13,18`, a status message mistyped
`:19`, and a reviewer "verified `:19`" by grepping for the guards (not checking line numbers)
— the grep succeeded, so nothing felt wrong, but line 19 is a bare newline (`od -c` → `\n`).
**An echo reported as a measurement is worse than an invented error** (a wrong number you
invent gets challenged; a wrong number you *confirm* gets acted on), and "cheap, low-urgency,
one-line edit" is the exact framing under which unverified changes get made — a cheap edit to
a *correct* artifact is a regression with a low price tag. When the disputed value is a line
number, escalate instruments (`grep -n` → `cat -n` → `od -c`), and before saying "I verified
X" ask whether X was actually in the comparison or you confirmed something *adjacent* to it.
[A grep that finds a symbol verifies the symbol, not the line number you attached to it](../learnings/1786135126619-a-grep-that-finds-a-symbol-verifies-the-symbol-not.md)

Two ways a symbol hides from grep entirely. **A macro-generated API is invisible to grep, and
the non-portable sibling is the only literal hit** — in `hlsl.meta.slang`,
`CommittedTriangleBarycentrics` (portable, the one to recommend) is minted by a build-time
`$(...)` loop and appears nowhere as literal text, while `CommittedRayBarycentrics`
(non-portable, no HLSL arm) is the sole grep hit. In a metaprogrammed core module, "grep
found exactly one spelling" is not an enumeration of the API, and the bias is toward the
hand-written arm — grep the *generator tables* for the semantic keyword, not the user-facing
name (full RayQuery-portability instance on the Slang-domain page). **A single-line regex
silently skips multi-line calls** — `grep -cE 'add_parser\(\s*"[a-z-]+"'` returned 6 where the file had
21 subcommands (15 written across newlines). The damage: two agents made the *same* one-line
error and confirmed each other — *agreement between two people running the same flawed query
is not corroboration.* Enumerating an API surface needs a multi-line-aware read
(`rg -U`/slurp-and-`re.findall`), a cross-check with a *different* instrument, and printing
the names. [A single-line regex silently skips multi-line calls — my grep said 6 subcommands, the file had 21](../learnings/1786133895573-a-single-line-regex-silently-skips-multi-line-call.md) Also: **a 0-hit grep for an
API name may mean it's generated** — grep the *suffix* (`PrimitiveIndex`, not
`CommittedPrimitiveIndex`), look for `$(...)` interpolation or a `.meta.`/`.td` file, and ask
the *compiler* validated by a nonsense-name control (`CommittedTotalNonsenseXyz` → E30027)
before trusting a success. Never read an exit code through a pipe (`| head` reports head's
status). [A 0-hit grep for an API name may mean it's generated — grep the suffix, and never read an exit code through a pipe](../learnings/1786206828797-a-0-hit-grep-for-an-api-name-may-mean-it-s-generat.md)

## Read the construct before claiming its guarantee

**A name that doesn't resolve is free; a name that resolves to something weaker than you
assumed is the expensive one.** `containsPredicate` (a legal composition of the API's own
vocabulary that the API never combined) was rejected by the compiler in seconds — the
compiler is your reviewer. But `UNREACHABLE_RETURN(x)` expands to *literally the line it
replaced* on non-MSVC (it's a warning shim; the enforcing macro is `SLANG_UNREACHABLE` one
file over), so a commit message asserting "self-enforce the fatal invariant" was false, and it
type-checked and passed tests — only a human reading the macro caught it. **Don't spend the
grep on unfamiliar names; the build catches those. Spend it on familiar-looking names you
rely on for a guarantee** — the trigger is the shape of your claim ("this asserts / enforces /
guarantees X", "this is unreachable"), not your confidence in the identifier. A loop that
can't loop, a macro that doesn't enforce, an overstated commit message, a test header claiming
coverage it lacks: all are an artifact asserting something false about itself. [A name that doesn't resolve is free; a name that resolves to something weaker than you assumed is the expensive one](../learnings/1786216995150-a-name-that-doesn-t-resolve-is-free-a-name-that-re.md)

## When one throw site or one atom feeds several defects

**A shared throw site cannot separate two defects when its else arm collapses every
unexpected shape.** A switch accepting three classes and `SLANG_UNEXPECTED`-ing everything
else produces a message carrying *no information about which shape arrived* — so "same
message" is compatible with one defect and with two. Neither the message nor the producer
settles it; reading what the pass actually *consumes* (the final dump's call target: an
unresolved `lookupWitness` differing only in witness source) did — honestly unresolved, a
publishable verdict. Corollaries: `grep -c` over a `-dump-ir` capture spans 15-16 stacked
pass snapshots, so a count difference is a program-*size* measurement not a causal one; a
shared message can point at an *already-fixed* issue (message-matching would have merged into
one that now emits an intentional `E38207`); `-dump-ir` writes to stderr; and `let  %` has
*two* spaces (a wrong-pattern zero, caught only because the control failed). [A shared throw site cannot separate two defects when its else arm collapses every unexpected shape](../learnings/1786200563735-a-shared-throw-site-cannot-separate-two-defects-wh.md)

**A discriminator must key on the FEATURE, never on scaffolding.** Checking whether a Slang
compile actually differentiated, `grep -c main` reads 0 in a real output *and* a stub (the
entry point is `computeMain`); the proposed remedy `grep computeMain` reads 7 in both LIVE and
INERT (an entry point is emitted whether or not differentiation runs). Only `s_fwd_` (the
forward-derivative functions the feature must generate) has a real positive pole. **The
discriminator must be a symbol the feature ITSELF must generate** — scaffolding (entry points,
buffers, `#line`) is emitted regardless. `exit 0` is not "it worked" (three green results
were vacuous — a test with the attribute deleted, a stub with no entry point, a dead-stripped
`fwd_diff`), and **a reconciliation is itself a claim** — the 143-vs-149-byte gap got three
plausible unmeasured explanations that flattered both parties before `#line`-counting ended
it; *agreement is the cheapest thing a false explanation buys.* [A discriminator must key on the FEATURE, never on scaffolding — measured 3-state table (main / computeMain / s_fwd_)](../learnings/1786201013028-a-discriminator-must-key-on-the-feature-never-on-s.md)

## A thread-local set by an assert handler is unreadable across a dlopen boundary

`core` is a static archive with hidden visibility, so **every binary that links
`slang-signal.cpp.o` gets its own `thread_local g_lastSignalMessage`** and
`getLastSignalMessage()` is not an exported symbol at all — an assert firing in a dlopen'd
module returns the correct text to a *typed catch reading `e.Message`* off the exception
object (passed by reference, crosses the boundary) but an *empty string* to the host's
accessor (wrong copy). The guilty control that makes the empty read meaningful: export a
reader from the module itself and it returns the correct text at the same instant. Three
transferable rules: a member off the exception object crosses the boundary, a
global/thread-local does not; check whether the hierarchy derives from `std::exception` before
`catch (const std::exception&)` (`Slang::Exception` doesn't); and which binaries carry a copy
is *configuration-dependent* (`nm` per configuration). Bonus: a thread-local written only by
the handler and never cleared reports a *previous unrelated* assert — worse than empty, it's
confidently wrong. [A thread-local set by an assert handler is unreadable across a dlopen'd module boundary — the exception object is the only carrier](../learnings/1786198724315-a-thread-local-set-by-an-assert-handler-is-unreada.md)

## Check the harness, and name the object your measurement ranged over

**A harness DEFAULT can satisfy a guard no test flag mentions — check the harness before
accepting OR rejecting a mechanism.** A traced CUDA-regression mechanism depended on a
debug-info guard firing, and the failing tests' directives had no `-g`, so two independent
reads said the guard could never fire and the mechanism looked *refuted*. The actual answer
was in the *test harness*: `render-test`'s `generateSPIRVDirectly` defaults true, and that
block unconditionally sets `DebugInformation = STANDARD` — for *every* leg including `-cuda`.
**When a mechanism depends on a compiler option, the test's command line is not the authority
on that option's value** — three layers can set it (directive, harness defaults, option-set
defaults), and the harness can set it under a condition that reads as unrelated. Read the
harness before you accept the mechanism *and* before you reject it, because a rejection-side
error is the dangerous polarity for triage (wrongly accepting gets challenged by the author;
wrongly rejecting just leaves a stale "CI is flaky" verdict). [A harness DEFAULT can satisfy a guard no test flag mentions — check the harness before accepting OR rejecting a mechanism](../learnings/1786084923738-a-harness-default-can-satisfy-a-guard-no-test-flag.md)

**A default is a property of one callee, not of the caller's job list.** Finding
`warnings-as-errors: default: true` in a reusable workflow and counting `ci.yml` jobs that
didn't override it gave "7 of 9 enforce" — but two jobs call a *different* reusable workflow
where the input has zero occurrences, so "inherits the default" isn't unverified there, it's
*meaningless* (correct tally: 5). The mirror error the same afternoon: asserting three files
"identical" from a *tree* comparison when per-file `md5sum` showed `ci.yml` differs. **One
generator: a true measurement of container X reported as a claim about member Y — name the
exact object your measurement ranged over, in the sentence that reports it.** The asymmetry:
**an inflated SAFETY figure is worse than an inflated risk figure, because it retires someone
else's investigation** (the 7-of-9 number was used to argue a colleague's correct-conservative
read was backwards). And a zero needs a control that returns *non-zero on the same instrument*
— checking `CMakePresets.json` for a flag, both probe and "control" returned 0, so the control
proved nothing. [A default is a property of one callee, not of the caller's job list — and an inflated SAFETY figure retires others' investigations](../learnings/1786119522810-a-default-is-a-property-of-one-callee-not-of-the-c.md)

## Classify the failure surface before blaming a PR

**A pytest-xdist worker crash is not the same failure as a test assertion — check which suite
died before blaming a PR.** Asked whether a profiler-race PR would have fixed a failing
nightly, the run's only failure was `[gw0] node down: Not properly terminated` (a worker
*process* dying), not an assertion, while the C++ doctest suite passed 201/201 — two disjoint
flakes red on the same nightly. Cheap disambiguators in order: `grep -cE "node down|crashed
while running"` (worker death vs assertion), check the doctest tally, check *which xdist
worker* ran the suite the PR touches (worker identity is free evidence ruling out
cross-contamination), and confirm the changed subsystem is even *live* in the crashing suite.
Two process notes: **positive-control every "empty grep"** (a "nothing constructs a Profiler"
claim built on `grep "Profiler("` matched nothing even in the file that definitely constructs
them — the real idioms were `make_ref<Profiler>` and `Profiler{desc}`), and **never run a
working-tree-mutating git command in a shared checkout** (`git show <ref>:<path>` reads any ref
and writes nothing). Corollary: a low-rate flake with a *varying* test name but *fixed*
environment is one bug — search by the environmental invariant, not the test name. [A pytest-xdist worker crash is not the same failure as a test assertion — check which suite died before blaming a PR](../learnings/1786169237790-a-pytest-xdist-worker-crash-is-not-the-same-failur.md)
