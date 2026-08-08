---
name: feedback_an_assertion_that_cannot_fail_2026_08_07
description: "The 2026-08-07 spill of the assertion-that-cannot-fail family: CHECK-NOT is a FileCheck directive absent from diag=; the drill's own blind spot (a FAILED arm from the wrong cause); prose has no instrument; a repeated zero from a freshly-fixed regex; delegating a probe strips its control; probe-beats-verdict; 'no longer applies' and 'cannot be reached' are one claim; the reading that costs nothing to leave standing goes unaudited."
metadata:
  node_type: memory
  type: feedback
---

# An assertion that cannot fail — the 2026-08-07 instances

⛔ **Split out of [[feedback_optimized_lane_can_be_inert_for_the_fix]] on 2026-08-07 at 24,603 B against the
~24,986 B Read limit, which truncates the NEWEST content first — i.e. exactly these entries.** The parent keeps
the origin case (an optimized lane inert for the fix), the `CHECK-NOT`-must-be-bounded rule, and the
harness's-own-invocation rule. Everything dated 2026-08-07 lives here.

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

⛔⭐⭐⭐**WORST CASE OF THE CLASS (same fixer, hours later): an uncontrolled detector returned a FALSE POSITIVE
THAT EXONERATED THE GAP IT WAS CHECKING FOR.** Enumerating the seven `SV_Target` shapes for a coverage hole,
its first regex reported **6 "mixed" hits including its own test file** — i.e. *"the shape is already
covered, close the gap as a non-issue."* Cause: the regex classified **`float4` as an aggregate type**.
Rewritten with a builtin-type predicate **plus a must-hit control** against the known Metal case; the control
fires, and only then does the **0** for `tests/spirv` / `tests/glsl` carry information. Confirmed: **shape 6
— an aggregate `SV_Target` beside a scalar one — has zero Khronos coverage**, which is exactly the hole the
shipped regression went through.
⇒ ⭐⭐⭐**Rank a detector's failure by WHAT IT LICENSES, not by whether it errs.** A false negative wastes a
search; **a false positive that exonerates ENDS the search and closes a real defect as covered.** That is the
one direction with no downstream check, because nobody audits an all-clear they were hoping for.
⇒ **Any detector whose output could CLOSE an investigation needs its control run first, not after.**

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

### ⛔⭐⭐⭐ A SELF-REPORT CANNOT DISTINGUISH "I did the work and found nothing" FROM "I produced no work product" — the witness must be OUTSIDE the artifact

**`slang-reviewer`, PR #12417, 2026-08-07.** Reviewer A2's saved `final-review.md` was a **1,691-byte
meta-commentary tail reporting 0 bugs / 0 gaps / 0 questions — despite 254 Greps and 5 subagents.** The real
12,312-byte review had to be recovered from `stream.jsonl`. **A summarizer reading the saved file would have
reported "A2 found nothing," and nothing downstream would have contradicted it.**

⇒ ⭐⭐⭐**Worst variant of this whole family, because a false ALL-CLEAR on a correctness review CLOSES an
investigation rather than wasting one.** Every other instance tonight cost a search; this one would have
shipped a PR on the strength of an empty file.
⇒ ⭐⭐⭐**ITS DESIGN POINT, which is the part I would not have got right: the guard must key on work evidence
from a source THE REVIEW DID NOT WRITE** — the `tool-uses.jsonl` counts, never a field inside
`final-review.md`. **A truncated artifact reporting zeroes and a genuine clean review reporting zeroes are
byte-identical *inside* that file.** Only the external record separates them. So the shape is
`assert greps > 0 && subagents > 0` **against** the reported counts, sourced externally.
⚠️**n=3 and discovered by a heuristic, not a check:** it has recovered a review from `stream.jsonl` in **three
separate sessions**, each time *"only because the byte count looked wrong."* ⇒ **wire it into the skill, not the
reviewer's memory** — *"a guard I have to remember at merge time is one that fails silently the night I'm busy."*
⭐**Generalizes past reviews: any agent's self-report of its own diligence is unfalsifiable from inside the
report.** Ask what external record would have to exist if the work happened, and check that instead.

### ✅ COMPANION — "keep the disposition, fix the reason", applied to a drop that was right for a wrong reason

**Same review, the `torch` editorial drop.** A2 dropped *"torch untested"* on the ground that **torch inherits
cpp's emit path verbatim**. Reviewer re-checked because I flagged it as the softest of three drops:
- ✅**Verified:** `slang-target.cpp:165-185` — `CodeGenTarget::PyTorchCppBinding` (`:167`) sits in the same
  case-fallthrough block as `CPPSource` (`:165`), resolving to `CapabilityName::llvm` under
  `isCPUTargetViaLLVM` (`:179`) else `cpp` (`:183`) ⇒ torch does reach the same `default:` arm of `dot`.
- ⛔**But "verbatim" is FALSE** — torch has its own passes (`generateHostFunctionsForAutoBindCuda`,
  `lowerBuiltinTypesForKernelEntryPoints`, `generatePyTorchCppBinding`, `handleAutoBindNames`,
  `slang-emit.cpp:1522-1526`).
- ✅**The drop survives on ORDERING instead:** those torch-only passes run at `:1522-1526`, **after**
  `specializeModule` (`:1421`) where `unrollLoopsInModule` runs — so the loop is already gone before any
  torch-specific pass sees the IR. **Torch cannot diverge on THIS change.**
⇒ ⭐⭐**Right conclusion, wrong reason — and the wrong reason is the CITABLE kind**, so correcting the basis
matters even when the disposition is unchanged. Third instance tonight of *keep the disposition, fix the reason*
(cf. `[CudaHost]` unreachability→NVRTC-rejects, and the comment-staleness→scope pair).

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

---

## → Cross-agent entries moved out (size limit, same night)

Six entries — probe-vs-verdict, the costs-nothing-to-leave-standing rule, the state-claim symmetry, the
debug-line-table instrument, the recalled-vs-default synthesis, and my prefix-read error — now live in
**[[feedback_evidence_hygiene_across_agents_2026_08_07]]**. This file crossed 24,986 B at 28,283 B; truncation drops the newest content first.

### ⭐⭐⭐ TWO NEW MEMBERS OF THE FAMILY, from slang#12397 — a FROZEN BRIEF, and a CONTROL CONSUMED BY THE FIX

**1. A delegated brief is a SNAPSHOT; changing the thing under test mid-flight turns the delegate's CORRECT
measurements into apparent anomalies.** The fixer briefed a build subagent to *expect rc=134*, then applied the
fix while it was still building. The subagent measured a **fixed** binary against a **pre-fix** premise and
reported the crash *"did not occur"* — reading as a contradiction when it was the fix working.
⇒ ⭐⭐⭐**Usual staleness is a stale ARTIFACT against a current premise; this is the inverse — a stale PREMISE
against a current artifact.** The delegate cannot detect it: its brief is the only spec it has.
⇒ ✅**Remedy: either freeze the tree while a delegate measures, or version the brief** (stamp the SHA/md5 the
expectation is bound to, so a mismatch is a *loud* precondition failure instead of a puzzling result).
Companion to the earlier rule *when you delegate a probe, delegate its control too* — same root: **what the
author knows is not what the delegate receives.**

**2. A CONTROL WHOSE DISCRIMINATING POWER IS CONSUMED BY THE FIX SUCCEEDING.** Its *"drop `[numthreads]` from
the callee"* control discriminated **pre-fix**; post-fix the two `-O0` disassemblies are **byte-identical**
(`diff` → no difference). That is the *intended* outcome, and it leaves the control **unable to discriminate
anything** — so a reader re-running it post-fix sees "no difference" and can read it as **the control breaking.**
⇒ ⭐⭐⭐**Distinct from the other two failure modes: a *vacuous* control never discriminated, an *inert* one
structurally cannot, and this one DID and then the fix removed its ability to.** Only this third kind looks
broken precisely *because* the change worked.
⇒ ✅**Remedy the fixer used and it is the right one: name the assertion that RETAINS power** (here: execution
mode on `%computeMain`, not `%helper`, with `%helper` still emitted) **and label the consumed control as
pre-fix-only.** Otherwise the next reader deletes a good test or distrusts a good fix.
⭐**Its anti-vacuity pair is the model to copy:** `OpExecutionMode %helper` = **0** *while*
`%helper = OpFunction` = **1** — the negative could have failed and didn't — plus explicit `passed test:` lines
rather than trusting an exit code that `no tests run` also produces.

⭐**And the append-only build mystery closed:** the harness killed the wrapper at **227/1453**, it relaunched
under `setsid`, ninja resumed with **227 cached / 1226 replanned** — exactly the two-denominator artifact
diagnosed positionally hours earlier ([[feedback_a_monitor_timeout_kills_the_build_it_watches]]). Host load
**151.83 on 8 cores (~19× oversubscribed by sibling containers)**; `BUILD_EXIT=0`, `FAILED=0`. **Slow, not
broken — and the diagnosis preceded the confirmation, which is the right order.**
