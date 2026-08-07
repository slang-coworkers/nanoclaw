---
name: feedback_optimized_lane_can_be_inert_for_the_fix
description: An optimized test lane can verify the end state while proving nothing about the mechanism the fix changed
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# An optimized lane can be INERT for the fix it's supposed to test

A test lane that runs with optimization on can pass **for reasons unrelated to your fix**. If the
optimizer folds away the very construct the patch manipulates, the lane verifies the *end state* and
says nothing about the *mechanism*. It is green, it looks like coverage, and it would stay green if
the fix were reverted — a [[feedback_name_what_you_held_fixed]] failure wearing a passing badge.

**How to apply — for any fix to a transform/legalization/lowering step:**
- Ask: **at this optimization level, does the construct I changed still exist by the time the check
  runs?** If the optimizer already resolved it, the lane cannot demonstrate the mechanism.
- Require an **unoptimized lane** that observes the intermediate form (e.g. `-O0` disassembly with
  SSA ids bound), and keep the optimized lane only as an end-state check — label which is which.
- **Enumerate the ops/paths the patch adds and confirm each is genuinely exercised.** An op added
  alongside others can ride along untested; a lane hitting 4 of 5 reads as full coverage.
- **Revert-test the lane:** if it still passes with the fix backed out, it isn't testing the fix.

**`CHECK-NOT` must be BOUNDED.** An unbounded / end-of-file-bounded negative check silently misses an
occurrence sitting immediately before the positive it should exclude. Bracket the `-NOT` between two
positive anchors that span the region of interest (e.g. `OpLabel` … `OpFunctionEnd`) — otherwise the
thing you're excluding can reappear exactly where the bug would reappear and the check stays green.

## The root rule: verify a test under the HARNESS'S OWN INVOCATION

Three sibling defects on one PR turned out to be the same mistake — a vacuous `CHECK`, a `-NOT`
bounded to EOF, and a check verified at the wrong optimization level. All three passed when run the
author's way and were wrong under the way the test suite actually runs them.

**So: run the test the way the harness will, with the exact flags/lanes it will use, and confirm it
FAILS with the fix reverted.** Hand-running the compiler with your own flags proves almost nothing
about a directive-driven test. On this PR the `-O0` ask found a genuine CI failure in
`desc-handle-nv-bindless-const-cast.slang` **before CI did** — the whole yield of taking this
seriously.

**Origin:** shader-slang/slang#12185 → PR #12186 (2026-08-03). The fix makes a global initializer
legally sinkable (`isInlinableGlobalInst`). pdeayton caught that the single `-O1` lane was **inert**:
at `-O1` both bitcasts have already folded, so the lane could never show the initializer was sunk.
Close-out now requires three lanes — `-O0` spirv-asm with SSA ids bound, `-O0` binary via
`-o <file>`, `-O1` folded `OpConstant` — plus proof that `kIROp_Select` (one of five ops the PR adds)
is actually exercised rather than riding along. The `CHECK-NOT` bounding rule came from the same pass:
an end-of-file-bounded `-NOT` missed a bitcast sitting right before the `OpIAdd`, precisely where the
removed bridge would reappear.

## ⛔⭐⭐⭐ 2026-08-07 — `CHECK-NOT` HAS NO MEANING UNDER `diag=`. It is a FileCheck directive, and `diag=` is not FileCheck.

**`slang-fixer` (#12396) hit this and proved it the right way:** it wrote `//CHECK-NOT: loop unrolling
failed`, then **asserted the absence of a string that IS present — and the test still passed.** ⇒ it had
verified the matcher's *input* was correct and never that the matcher *ran*.

✅**MINE-VERIFIED against the authoritative doc, and it corroborates categorically:**
`docs/diagnostics.md` on master (4,442 B) mentions **`CHECK-NOT` exactly ZERO times.** The annotation
grammar it enumerates is message text · severity (`warning`/`error`) · error code (`E20101`) · caret
columns, with two modes (default **exhaustive**; `non-exhaustive` ignores extra diagnostics). **There is no
negative form in the grammar at all.**

⚠️⭐⭐**SCOPE IT PRECISELY — "slang-test silently drops CHECK-NOT" is under-scoped and would retire a
directive that works.** The repo has **two different matchers**:
| directive | matcher | `CHECK-NOT` |
|---|---|---|
| `filecheck=` / `filecheck-buffer=` | **real LLVM FileCheck** | ✅ supported (subject to the bounding rule above) |
| `diag=` | slang-test's own annotation parser | ⛔ **not in the grammar** |
⇒ **The rule is "`CHECK-NOT` is a FileCheck directive," not "`CHECK-NOT` is broken here."** Under `diag=`
the correct way to assert an absence is **exhaustive mode** (the default): every emitted diagnostic must
carry an annotation, so an unexpected diagnostic fails the test by construction — which is what the fixer
switched to.

⭐⭐⭐**This is the FIFTH distinct mechanism by which a `CHECK-NOT` in this repo is inert, and the first that
is STRUCTURAL rather than conditional:**
1. **unbounded / EOF-bounded** — the occurrence hides right before the positive anchor (this file, above).
2. **stream-ordering** — `slang-test-main.cpp:1882-1890` appends **stderr before stdout**, so a `-NOT`
   anchored after a positive is already past the text ([[project_12330_entrypoint_throws_not_diagnosed]]).
3. **pattern never present anyway** — passes even when flipped to a present pattern
   ([[project_10918_debug_global_variable_rework]], caught in review round 13 of 13).
4. **vacuous by construction** — `tests/cuda/optix-exported-device-function.slang`
   ([[project_12182_cuda_optix_callable_rdc_linkage]]).
5. **wrong matcher — the directive does not exist** (this entry). ⇐ *no bounding, ordering or content fix
   helps; the line is inert on every input.*

⇒ ⭐⭐⭐**FIVE mechanisms, one remedy — which is the argument for the fixer's framing over a trap list:
MAKE EVERY NEGATIVE ASSERTION FAIL ON PURPOSE ONCE.** Flip it to a pattern you know is present; if the test
still passes, the assertion is inert. That single drill catches all five, including ones nobody has
enumerated yet. **A trap list grows without bound and is always one mechanism behind; the drill is
closed-form.** (The fixer reached it after hitting mechanism 5 *minutes after documenting mechanism 1* — the
enumeration approach failing in real time is what motivated the procedure.)

### ⛔⭐⭐⭐ THE DRILL'S OWN BLIND SPOT — a `FAILED` arm can fail for the wrong reason, and nobody audits it

**The drill above ("make every negative assertion fail on purpose once") has a failure mode, hit by the same
fixer hours later.** Its revert-drill ARM B reported `FAILED` — the wanted result — so it banked it. The
actual failure was **`Exhaustive check failed: 2 diagnostics without annotations`**, an artifact of its own
edit. Asking what the binary actually *named*: `f(float)` — **the correct answer.** ⇒ the arm it read as
"the test discriminates" was proof of nothing, and the swap it justified would have made the test vacuous.

⇒ ⭐⭐⭐**A HARNESS PASS/FAIL IS A CONJUNCTION OVER EVERYTHING IT CHECKS. It can REFUTE a specific claim; it
can never CONFIRM one.** When the claim is about one property ("which candidate does it name?"), read the
**artifact carrying that property** — the diagnostic text, the emitted symbol — not the verdict.

⭐⭐**RECONCILES TWO PEERS' APPARENTLY-OPPOSITE FRAMINGS, and the merged form is sharper than either.**
`slang-ci-babysitter` (same night): *"an **alarming** reading gets audited less than a comforting one."*
`slang-fixer`: *"a **confirming-direction failure** from the wrong cause is worse than a blank — my `FAILED`
looked like evidence rather than absence, so nothing prompted me to ask why."* Both are instances of one
rule, and neither polarity is intrinsic:
⇒ ⭐⭐⭐**The unaudited reading is THE ONE THAT CONFIRMS YOUR HYPOTHESIS — and which polarity that is flips
per arm.** In a revert drill you *want* the failure, so **`FAILED` is the unaudited direction there**; in a
green-build check you want the pass, so `EXIT=0` is. ⇒ **Before reading any arm, name which outcome you are
hoping for — that is the one that needs the cause confirmed.** "Distrust bad news" and "distrust good news"
are both wrong halves; distrust the *expected* news.
⭐**And a blank is SAFER than a wrong-cause confirmation**, because absence prompts investigation while a
confirming-direction result terminates it. Same reason a broken instrument that manufactures findings costs
more than one that hides them.

### ⛔⭐⭐⭐ `slangi` DROPS WARNINGS — and delegating a probe silently transfers its arming obligation to someone who was never told

**Durable repo fact (`slang-fixer`, 2026-08-07, slang#12311 / PR #12312).** It needed to prove that #12179's
new cast-to-user-struct warning does **not** fire on its test. Its first probe grepped **`slangi`** output.
⛔**`slangi` prints diagnostics only when `loadModule` FAILS, so warnings are silently dropped — while ERRORS
do print, which is what hides the defect.** A warning-absence check run through `slangi` is a structural
false-green. ⇒ **Grep `slangc` for diagnostics; never `slangi`.** Re-measured on `slangc -no-codegen` across
default / `2026` / `202c` with a **passing positive control** — the control is the only reason the negative is
trustworthy.

⇒ ⭐⭐⭐**THE NEW MECHANISM: it delegated the probe to a subagent, and the arming obligation evaporated in
transit.** Its own words: *"delegating a check quietly transferred its validation to someone I never told
owned it."* The author knows the probe needs a must-hit control; the subagent receives only the command. **A
delegated check arrives stripped of the reason it needed arming** ⇒ **when delegating a probe, delegate its
CONTROL too** — state the must-hit case in the same instruction, or run the control yourself and hand over
only the measurement.
⭐*This is the sibling of the drill's own blind spot above: there the wanted outcome went unaudited; here the
audit requirement was never transmitted.* Both end at the same place — a green from an instrument nobody
proved could go red.

### ⛔⭐⭐⭐ A REPEATED ZERO FROM A FRESHLY-FIXED REGEX READS AS CONFIRMATION — and `:-cuda` is why it happened

**`slang-fixer`, 2026-08-07, slang#12395 census.** It needed the count of existing tests exercising CUDA.
Three rounds, three zeros, all wrong:
```
grep -rl '-target cuda'                            → 0    (triage's pattern — LITERALLY TRUE)
grep -rlE '(^|[[:space:]])-cuda([[:space:]]|$)'    → 0    (its "two-spelling fix")
grep -rlE '[:[:space:]]-cuda([[:space:]]|$)'       → 12   (correct)
```
⛔**Root cause, and it is a durable slang-repo fact: in a slang-test directive the flag follows a COLON, not
whitespace** — `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cuda -compute`. **Any whitespace-anchored
pattern is structurally blind to the first flag after the colon.** Use a class: `[:[:space:]]`.

⇒ ⭐⭐⭐**THE META-TRAP: it fixed the instrument, re-ran, got the SAME zero, and read the agreement as
verification — but both runs shared a defect the fix did not address.** This is corroboration-vs-echo applied
to your **own successive measurements**: two runs of *your* pattern are not two independent measurements if the
second inherits the first's anchoring assumption. ⇒ **After fixing a probe that returned zero, do not re-run
it for confirmation — run it against a case you KNOW must hit.** A freshly-fixed regex owes you a positive
control, not a repeat.

⭐⭐**And the triage claim was LITERALLY TRUE while answering the wrong question** — "0 of 40 files contain
`-target cuda`" is accurate; 12 files reach CUDA under a different spelling. ⇒ **"Is this statement true?" and
"does this statement answer my question?" are different audits, and a true statement passes the first
forever.** The dangerous inherited fact is not the false one — it is the true one whose scope is implicit.
⭐*Consequence here inverted the finding's meaning: the coverage gap survived **despite** live CUDA execution
coverage, because buffer-comparing tests cannot observe a dropped inlining hint (performance, not results) ⇒
the 12 files are **non-regression evidence**, not a missed-coverage embarrassment.*

### ⭐⭐⭐ THE COMPLEMENT: a PROSE edit has no instrument at all — so self-review cannot catch it, in either direction

Everything above is an assertion that **exists and cannot fail**. A comment / doc / PR-body edit is the other
case: **there is no assertion to arm.** No test turns red on a wrong comment, and — the part that makes this
more than a truism — **no test turns red on a wrong CORRECTION to a wrong comment either.**

**Evidence (`slang-fixer`, CUDA `[noinline]`, 2026-08-07): codex caught the same class of error TWICE on one
comment.** v1 claimed *"nvcc rejects `__noinline__` on kernels"* — false, it **accepts and ignores**. The
correction then over-claimed the other way, asserting the specifier is meaningful *"only"* on the device
branch — also false, since `[CudaHost]` functions **can** be inlined into host callers; `__host__` is
excluded by **product scope, not meaninglessness.** Two passes, two errors, opposite directions, zero
instrument between them.

⇒ ⭐⭐⭐**Rank review need by whether the change has a failure mode, and prose ranks HIGHEST, not lowest.**
The intuitive ordering — *"it's just a comment, no review needed"* — is exactly inverted: code carries a test
that can contradict the author, prose carries nothing, so the author's confidence is the only check and it
travels unchanged into the fix. **An external reader is the ONLY available instrument for a prose claim.**
⭐**Corollary for the drill:** you cannot "make a comment fail on purpose." When a claim in prose is
load-bearing (a mechanism, a "this is safe because…", a scope boundary), either **cite the artifact that
grounds it** — `file:line` + the ref you measured at — or state only the part that is verifiable from the
code in front of the reader. The fixer's final version does this: it claims only the kernel fact and drops
the unverifiable nvcc behaviour, *which it had actually measured* — because the code cannot show it and the
placement argument does not need it.

⚠️**Its four-in-one-task tally spans matchers and tools** — region-scoped `CHECK-NOT`, unimplemented
`CHECK-NOT`, a probe on dead-code-eliminated code, and `pgrep -cf` matching **its own command line**. Only
the first two are FileCheck/`diag=`; the drill generalizes because the class is *"an assertion that cannot
fail,"* not *"a test directive."*

Related: [[project_12185_bindless_texture_nv_desc_handle_nonimage]] ·
[[feedback_green_job_skipped_backend_zero_coverage]] (the CI-level sibling: green job, backend never
executed) · [[feedback_name_what_you_held_fixed]] ·
[[feedback_an_identifier_that_does_not_distinguish_its_members]] (same shape: `CHECK-NOT` as a name that
does not distinguish which matcher will read it).
