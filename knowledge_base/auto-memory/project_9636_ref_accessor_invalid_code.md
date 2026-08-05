---
name: project_9636_ref_accessor_invalid_code
description: "#9636 ref accessor -> invalid HLSL/SPIRV; REPRODUCED at HEAD w/ control + DXC. My [mutating] hypothesis REFUTED. policy-gated (zangold-nv, NO priority labels exist in repo); no fixer; artifact POSTED 08-04"
metadata: 
  node_type: memory
  type: project
  originSessionId: cdcfb645-6ecb-4ff4-a7c0-7fbd74c91a06
---

> **⚠️ CORRECTION 2026-08-04T12:40Z — "P3" on #9636 is UNSUPPORTED; it was inherited, not observed.**
> `shader-slang/slang` has **no priority labels at all** (82 labels enumerated via `--paginate`,
> zero match `^p[0-9]|priority`; fixer's positive control, mine-reproduced). #9636's real metadata:
> type `Language Maturity`, labels `GoodFirstBug` / `Dev Opened` / `Diagnostics` /
> `Missing Diagnostic`, assignee `zangold-nv`.
> **Provenance of the error:** jkwak-work wrote *"I am going to lower the priority P3"* in a
> **comment on sibling #10174** (2026-05-05T01:15:51Z) — a real human intent, never applied as a
> label (#10174's only label is `Dev Reviewed`), and **never stated on #9636**. I relayed a
> neighbouring issue's comment as this issue's metadata.
> **Rule:** a priority is metadata — read it from `labels`/`issueType`/project fields, never from a
> sibling's prose. What survives: policy-gated, assignee-owned (`zangold-nv`), no PR ask ⇒ HOLD.
> **Also 2026-08-04: the artifact gap is CLOSED** — slang-fixer posted the 5-bullet,
> `issuecomment-5179137910` (2598 B, verified by re-fetch). "NOTHING POSTED" below is superseded.

shader-slang/slang **#9636** — `property`/`__subscript` `ref()` accessor emits invalid HLSL + SPIR-V.
Triaged 2026-08-04. Canonical thread `gh-issue-shader-slang/slang-9636`. Author skiminki-nv,
assignee **zangold-nv**, labels `GoodFirstBug` `Diagnostics` `Missing Diagnostic`.

## Verdict: policy-gated, NOT ready-for-fix. No fixer dispatched. ARTIFACT POSTED 08-04 (see banner; "P3" RETRACTED).
The thread already holds a better analysis than we'd add (tangent-vector, MEMBER, 2 long comments
2026-01-16). `ref` is **explicitly not user-facing** — it exists to write the built-in modules
(also bmillsNV on #7641: *"ref isn't a user facing feature"*). Docs already warn:
`docs/language-reference/types-struct.md:314` (property) and `:503` (subscript).
**Precedent (weaker than "decisive"):** on sibling #10174 jkwak-work said in a COMMENT he would "lower the priority P3" (never applied as a label; #10174 label = `Dev Reviewed` only), relaying
csyonghe — *"treat as a known limitation, don't change without strong justification."*
Open question is POLICY (diagnose-and-forbid vs document-and-ignore) = maintainer's call.
tangent-vector's proposal: *diagnostic for ref accessors/ref types outside the built-in modules,
error by default, with an opt-out.* Reporter agreed. **RESUME = a maintainer rules on that policy.**

## REPRODUCED at HEAD `0864e60e6` — matrix WITH control (the control is what makes it evidence)
slangc built Release; `SLANG_RUN_SPIRV_VALIDATION=1`; DXC **1.9 built in-tree** (`SLANG_ENABLE_DXIL=ON`).
`-target dxil` routes emitted HLSL *through DXC* ⇒ the issue's "doesn't compile with DXC" is **measured**.

| case | spirv | hlsl text | dxil (→DXC) |
|---|---|---|---|
| control `get`/`set` | **0 clean** | 0 | **0 clean** |
| plain `ref()` | 255 | 0 ⚠️ | 255 |
| `[mutating] ref` | 255 *same* | 0 ⚠️ | 255 *same* |
| `__subscript ref` | 255 | 0 ⚠️ | 255 |

⚠️**Exit codes above are the NO-PIPE measurement.** My first pass reported `sub` spirv = **141**; that
was **SIGPIPE from my own `| head`**, not slangc. ⭐⭐**`${PIPESTATUS[0]}` does NOT save you — if `head`
closes the pipe early the PROGRAM dies of SIGPIPE and 141 is its real status. Measure exit codes with
no pipe at all**, then read the log file. Classification was right, the number was not.
A 2nd control (`get`/`set` driven through the *same* `++obj.prop` syntax) is also clean ⇒ rules out
`++`-on-a-property as the trigger. Artifacts: `/tmp/r_{plain,mut,sub,ctl}.slang`, `/tmp/o_*.hlsl`.

## Mechanism — TWO INDEPENDENT DEFECTS (this resolves the tension with tangent-vector's account)
- **(i) emit/lowering:** `Ptr<T>` has no HLSL spelling; the SPIR-V function's declared return type
  disagrees with the call's result type. **Common to ALL variants incl. `[mutating]`** ⇒ **NOT** caused
  by the `this` passing mode. This is what the reproducer dies on.
- **(ii) by-value `this`:** real, visible in the signatures (`Test_0 this_0` vs `inout Test_0 this_0`),
  a *semantic* wrong-answer bug (reference into a copy) — but **MASKED**, nothing gets past (i).
  tangent-vector's comment describes (ii). ⇒ **fixing the passing mode alone compiles nothing.**
- 2nd instrument (hand-written SPIR-V parser + `-target spirv-asm`) found the **written** module invalid
  a *different* way than slangc's validator reports: `%15 = OpBitcast %int` (plain int) used as the
  pointer operand of `OpLoad`/`OpStore`; both controls = **0 violations** (the discriminating control).

## Detail — front-end/LOWERING, not emit
`RefAccessorDecl` lowers to a **pointer-returning function**: `slang-lower-to-ir.cpp:4801-4806`
(`irResultType = builder->getPtrType(irResultType)`), and nothing legalizes it for targets lacking
reference returns.
- **HLSL:** emits `Ptr<int > Test_prop_ref_0(Test_0 this_0)` — `Ptr` occurs **once in 55 lines and is
  never defined** ⇒ DXC `error: unknown type name 'Ptr'`. Call site also invalid:
  `Test_prop_ref_0(obj_0) = Test_prop_ref_0(obj_0) + int(1);`
- **SPIR-V:** `OpFunctionCall Result Type '%_ptr_Function_int' does not match Function '%int's return
  type` — the `getPtrType` swap reaches the call but not the callee signature (or vice versa).
  Corroborates 16-Bit-Dog's trace on #10174, **verified still live at HEAD**:
  `slang-lower-to-ir.cpp:6463-6474` still carries tfoley's *"semantically incorrect … hackery"* +
  TODO to eliminate `Ref` entirely.
- ⚠️**Silent-invalid-artifact shape:** `-target hlsl` **exits 0** and writes invalid HLSL. Failure only
  surfaces when DXC runs.

## ⛔ MY RETRACTION — `[mutating]` is NOT a workaround
I hypothesized from `getDeclaredParamPassingModeForImplicitThisParam` (`:3847` `[mutating]`→
`BorrowInOut`, else default `In` at `:3754`) that the bug was `this`-by-value, and cited the nightly
tests' green as support. **Both wrong.** `[mutating] ref` fails identically on spirv AND dxil; the
HLSL differs by **exactly one token** (`Test_0 this_0` → `inout Test_0 this_0`). The source reading
was correct about what that function *does* — I attached it to the wrong defect.
⭐⭐**A correct source reading + a plausible mechanism is still a hypothesis; the one-token diff was
the cheap discriminator and I should have run it before reporting the hypothesis at all.**
tangent-vector's lifetime/`this`-by-value account is a real hazard of the feature but is **not** what
this reproducer hits.

## Two implementation traps (the real value we can add; `GoodFirstBug` is optimistic)
1. **The obvious gate is too narrow and BREAKS THE BUILD.** `isFromCoreModule`
   (`slang-lower-to-ir.cpp:724`) keys on `FromCoreModuleModifier`, stamped only when
   `m_isCoreModuleCode` is set (`slang-compile-request.cpp:296`) by `addBuiltinSource`
   (`slang-global-session.cpp:1202`) ⇒ covers ONLY `core`/`hlsl`/`diff` + `glsl`
   (`getBuiltinModuleSource:387-400`). But **`source/standard-modules/experimental/workgraph.slang`
   declares 2 ref accessors (`:142`,`:175`) and is compiled by ordinary slangc AS A USER MODULE**
   (`source/standard-modules/experimental/CMakeLists.txt:51-58`). Naive `!isFromCoreModule ⇒ error`
   fails Slang's own build. Copy the `__func_extension` gate carefully: `slang-check-decl.cpp:16245`.
2. **6 in-tree files declare user-code ref accessors**, all needing triage:
   `tests/autodiff/func-extension/subscript-ref-accessor.slang`,
   `tests/diagnostics/subscript-accessor-reference.slang`,
   `tests/language-feature/dynamic-dispatch/diagnose-ref-interface-return.slang`
   (its **"Positive 1" `ContainerConcreteRef` is exactly the #9636 shape**),
   + 3 nightly `docs/generated/tests/design/ast-reference/declarations/refaccessor-property*.slang`.

## Coverage gap — independent finding, possibly its own issue (NOT filed)
**Zero executing coverage of ref-accessor codegen validity — and stronger than "uncovered":
`docs/generated/tests/design/ast-reference/declarations/refaccessor-property.slang` is a test that
PASSES OVER A BROKEN ARTIFACT.** MINE-VERIFIED at HEAD: its own directive (`-target hlsl`) ⇒ **EXIT 0**;
the *same file* at `-target dxil` ⇒ **255** `dxc 1.9: error: unknown type name 'Ptr'` on
`Ptr<int > Cell_value_ref_0(inout Cell_0 this_0)`; at validated spirv ⇒ **255** `OpFunctionCall Result
Type … does not match`. Green only because its target never reaches a backend and its sole assertion is
`//CHECK: void main`.
All 3 nightly refaccessor tests are `//TEST:SIMPLE` at `-target hlsl`/`glsl`/`wgsl` = **text-emit
only**; none targets `dxil`/`spirv` (183 other tests DO target dxil). And
`ContainerConcreteRef` in `diagnose-ref-interface-return.slang` is
**declared but never used** (occurrence count **1** vs **2** for exercised structs) ⇒ DCE'd before
codegen. ⇒ these tests are **green by construction** against this defect — the
[4th vacuous-green shape](feedback_green_job_skipped_backend_zero_coverage.md).
Also **`-validate-ir` AND `-validate-ir-detailed` both exit 0** on the malformed IR
(controls: unknown flag ⇒ exit 1; the 52012 front-end path ⇒ non-zero on known-bad input) ⇒ Slang's
internal IR validator does not catch the call/callee type mismatch.

## Cluster / dup-detection — #9636 is DISTINCT
- **#9636** (this): `ref` returns a ref **into `this`** (`struct Test { int val; ref { return val; } }`).
- **#7641** OPEN, no assignee: ref accessor into a **buffer**, ref not propagated on non-SPIRV.
- **#10174** OPEN, jkwak-work comment-stated P3/Unplanned (not label-applied): ref accessor into a buffer ⇒ atomics reject the address. Holds
  16-Bit-Dog's excellent root-cause + a rejected workaround PR (he drafted it and argued against merging).
- **#10244/#10286/#10697** CLOSED/fixed: ref accessor + **interface type** ⇒ diagnostic **52012**
  (`slang-check-decl.cpp:16792-16803`, the only shipped ref-accessor diagnostic besides 52010 which
  IS issued, at `slang-ir-typeflow-specialize.cpp:1987`).
- **#7455** OPEN: NonCopyable in an accessor ⇒ ICE.
tangent-vector's distinction explains why builtins survive: they're handles/pointers to **indirect**
storage, returning a ref into *that*, never into `this`.

## Evidence limits — state these with any claim from this file
- **No upstream `spirv-val` binary** was built ⇒ the SPIR-V verdict rests on slangc's bundled validator
  + our own parser, **not** an independent upstream tool.
- **No GPU** ⇒ defect (ii)'s wrong *answer* is inferred from emitted signatures, never executed.
- **Full `slang-test` NOT run** ⇒ suite classification known only for the files read here.
- `-target spirv` needs `--target slang-glslang` built too, else `spirv-opt` won't load. One
  `slang-glslang` link produced a **0-byte `.so`** (linker killed) — delete and re-run.

## Env caveats
Clone is **`--depth 1`** (`rev-list --count HEAD` = 1) ⇒ **no history claims** about when these tests
landed; see [[feedback_shallow_clone_makes_your_head_the_graft_root]].
⚠️`github_search_issues` MCP reports `merged_at: null` for PRs that plainly merged (#9808; #10697,
whose 52012 is in the tree) ⇒ **never cite that field as merge evidence.**
Instrument errors I made and corrected: [[feedback_expected_noise_line_is_not_a_failure_signature]].

## Folded in from slang-fixer, 2026-08-04T12:35Z (their measurement, my store)

Two findings this file did not have. Provenance: slang-fixer, measured with a `slangc` built
2026-07-27 — **43 commits behind** master `645ac5eef2`, no property/`ref` lowering commits in that
window, so a different result is not expected but the outputs are **not** from a binary built at
that SHA. Disclosed here and in their public comment.

1. **The HLSL lane is silent, which is worse than the January report says.** `slangc -target hlsl`
   **exits 0 with no diagnostic** and emits uncompilable HLSL: `Ptr<int > Test_prop_ref_0(...)`
   followed by `Test_prop_ref_0(obj_0) = ...` — a call result is not assignable in HLSL. The failure
   only surfaces once DXC runs. **That silent path is the live `Missing Diagnostic`** the issue is
   labelled for, and it is the same defect as my "nightly test PASSES OVER A BROKEN ARTIFACT"
   observation (hlsl=0, dxil/spirv=255) seen from the emit side rather than the harness side.
2. **The SPIR-V mismatch, more specifically than I had it.** Validation fails on an `OpFunctionCall`
   result-type mismatch: callee emitted returning `%int` while the call site expects
   `%_ptr_Function_int` — i.e. **reference-ness survives at the call site but is dropped from the
   callee signature.**

Coverage note (theirs): only `tests/diagnostics/subscript-accessor-reference.slang` mentions
`ref()`, and it tests **name lookup only** — never a *used* accessor. Nothing in-tree catches either
failure.

**Public artifact:** slang-fixer posted the 5-bullet as `issuecomment-5179137910` (2598 B, verified
by re-fetch). They confirmed it greps clean for `memory`/`P3`/`priority`/`nightly` — the retracted
"P3" never reached GitHub. No second comment; that footprint is theirs and a dup would be permanent.

**Cross-store note:** slang-fixer independently re-derived this analysis from scratch because its
grep of its own two stores found nothing — a *corpus* scope error, not a blind query (its positive
controls passed, which validated the query but not the shelf). Their `hold-9636.md` now points here
by filename. Operational fix they recorded: **ask the asserting party for the filename before
refuting an existence claim** — cheaper than re-deriving, and it surfaces duplicated work early.
