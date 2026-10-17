---
type: project
name: project_9636_ref_accessor_invalid_code
description: "slang#9636 `ref()` accessor emits invalid HLSL/SPIR-V — REPRODUCED at HEAD with controls + DXC; two independent defects (Ptr-returning lowering, masked by-value `this`); `[mutating]` is NOT a workaround. POLICY-GATED on zangold-nv (diagnose-and-forbid vs document); no fixer; 5-bullet POSTED 08-04 (`5179137910`). No priority labels exist in the repo — the 'P3' was a sibling's comment."
metadata:
  node_type: memory
  type: project
  originSessionId: cdcfb645-6ecb-4ff4-a7c0-7fbd74c91a06
---

# slang#9636 — `property`/`__subscript` `ref()` accessor → invalid HLSL + SPIR-V

Triaged 2026-08-04 on canonical thread `gh-issue-shader-slang/slang-9636`. Author `skiminki-nv`,
assignee **`zangold-nv`**, type `Language Maturity`, labels `GoodFirstBug` / `Dev Opened` /
`Diagnostics` / `Missing Diagnostic`.

**State: HOLD, policy-gated.** No fixer dispatched and no PR asked for. `slang-fixer` posted the
5-bullet as [`5179137910`](https://github.com/shader-slang/slang/issues/9636#issuecomment-5179137910)
(2598 B, verified by re-fetch), the only bot comment there. Live state was last read 2026-08-04;
GitHub returned 401 on 2026-10-16, so it was not re-read then.
**RESUME:** a maintainer rules on the policy question below.

## Why it is held: the open question is policy

`ref` is explicitly not user-facing: it exists for the built-in modules (bmillsNV on #7641), and the
docs warn at `docs/language-reference/types-struct.md:314` and `:503`. tangent-vector proposed, and the
reporter agreed, a diagnostic for ref accessors outside the built-in modules, error by default, with an
opt-out. Diagnose-and-forbid vs document-and-ignore is the maintainer's call.

⛔ **No priority applies.** `shader-slang/slang` has no priority labels (82 labels paginated, none
match `^p[0-9]|priority`). The "P3" I first wrote came from jkwak-work's comment on **sibling #10174**
("I am going to lower the priority P3"), which was never applied as a label and never said on #9636.
Read priority from `labels` / `issueType` / project fields, never from a sibling's prose.

## Reproduction at HEAD `0864e60e6` (Release slangc, DXC 1.9 in-tree, SPIR-V validation on)

| case | spirv | hlsl text | dxil (→DXC) |
|---|---|---|---|
| control `get`/`set` | 0 | 0 | 0 |
| plain `ref()` | 255 | 0 ⚠️ | 255 |
| `[mutating] ref` | 255 | 0 ⚠️ | 255 |
| `__subscript ref` | 255 | 0 ⚠️ | 255 |

A second control that drives `get`/`set` through the same `++obj.prop` syntax is also clean, which
rules out the `++` syntax as the trigger. These exit codes come from runs with no pipe. My first pass
read `141` for `sub`/spirv, which was SIGPIPE from my own `| head`
([[feedback_piping_to_head_masks_the_exit_code_you_are_testing]]). **`-target hlsl` exits 0 with no
diagnostic and writes uncompilable HLSL.** That silent path is the live `Missing Diagnostic`.

## Mechanism: two independent defects

1. **Lowering (what the reproducer dies on, in all variants).** `RefAccessorDecl` lowers to a
   pointer-returning function at `slang-lower-to-ir.cpp:4801-4806`
   (`irResultType = builder->getPtrType(irResultType)`), and nothing legalizes it for targets without
   reference returns.
   - HLSL: `Ptr<int > Test_prop_ref_0(Test_0 this_0)`, where `Ptr` is never defined. The call site
     `Test_prop_ref_0(obj_0) = … + int(1);` is also not assignable.
   - SPIR-V: `OpFunctionCall Result Type '%_ptr_Function_int' does not match Function '%int's return
     type`. The pointer survives at the call site but is dropped from the callee signature. An
     independent SPIR-V parser also finds `OpBitcast %int` used as the `OpLoad`/`OpStore` pointer,
     with 0 violations on either control.
   - tfoley's "semantically incorrect … hackery" TODO to eliminate `Ref` is still at
     `slang-lower-to-ir.cpp:6463-6474`, matching 16-Bit-Dog's trace on #10174.
2. **By-value `this` (real but masked).** It shows as `Test_0 this_0` vs `inout Test_0 this_0` and
   would give a reference into a copy. This is the defect tangent-vector's comment describes. Fixing it
   alone compiles nothing.

⛔ **Retracted: `[mutating]` is not a workaround.** I attached
`getDeclaredParamPassingModeForImplicitThisParam` (`:3847` `[mutating]`→`BorrowInOut`, else `In` at
`:3754`) to the wrong defect. `[mutating] ref` fails identically, and its HLSL differs by exactly one
token. That one-token diff was the cheap discriminator, and I should have run it before stating the
hypothesis.

## Implementation traps (why `GoodFirstBug` is optimistic)

1. **The obvious gate breaks the build.** `isFromCoreModule` (`slang-lower-to-ir.cpp:724`) keys on
   `FromCoreModuleModifier`. That modifier is stamped only for `core`/`hlsl`/`diff`/`glsl`, via
   `addBuiltinSource` (`slang-global-session.cpp:1202`) and `getBuiltinModuleSource:387-400`. But
   `source/standard-modules/experimental/workgraph.slang` declares ref accessors at `:142` and `:175`,
   and it compiles as a user module (`experimental/CMakeLists.txt:51-58`). Model the gate on the
   `__func_extension` gate at `slang-check-decl.cpp:16245`.
2. **Six in-tree files declare user-code ref accessors** and need triage:
   - `tests/autodiff/func-extension/subscript-ref-accessor.slang`
   - `tests/diagnostics/subscript-accessor-reference.slang` (name lookup only)
   - `tests/language-feature/dynamic-dispatch/diagnose-ref-interface-return.slang`, whose
     `ContainerConcreteRef` is the exact #9636 shape but is never used, so it is DCE'd
   - 3 nightly `docs/generated/tests/design/ast-reference/declarations/refaccessor-property*.slang`

## Coverage gap (independent finding, not filed)

No test executes ref-accessor codegen. The nightly `refaccessor-property.slang` is `//TEST:SIMPLE` at
`-target hlsl` with only `//CHECK: void main`. It **passes over the broken artifact**: the same file
exits 255 at `dxil` and at validated `spirv`. That is the vacuous-green shape in
[[feedback_green_job_skipped_backend_zero_coverage]]. `-validate-ir` and `-validate-ir-detailed` both
exit 0 on the malformed IR, so the internal validator misses the call/callee mismatch.

## Cluster: #9636 is distinct

- **#9636:** a ref into `this` (`struct Test { int val; ref { return val; } }`).
- **#7641** (open): a ref into a buffer, not propagated on non-SPIR-V targets.
- **#10174** (open): a ref into a buffer that atomics reject. It holds 16-Bit-Dog's root cause and a
  workaround PR that its own author argued against merging.
- **#10244 / #10286 / #10697** (fixed): ref accessor plus interface type → diagnostic 52012
  (`slang-check-decl.cpp:16792-16803`). 52010 is issued at `slang-ir-typeflow-specialize.cpp:1987`.
- **#7455** (open): `NonCopyable` in an accessor causes an ICE.

Built-ins survive because they return refs into indirect storage, never into `this`.

## Evidence limits (state these with any claim)

- No upstream `spirv-val`: the SPIR-V verdict rests on the bundled validator plus our own parser.
- No GPU: defect 2's wrong answer is inferred from signatures and was never executed.
- No full `slang-test` run.
- `--depth 1` clone, so there are no history claims
  ([[feedback_shallow_clone_makes_your_head_the_graft_root]]).
- `slang-fixer` measured with a slangc 43 commits behind `645ac5eef2`, with no relevant commits in the
  gap, and disclosed it.
- The `github_search_issues` MCP returns `merged_at: null` for merged PRs, so never cite that field.
- Instrument slips I made → [[feedback_expected_noise_line_is_not_a_failure_signature]].

**Cross-store:** `slang-fixer` re-derived this analysis from scratch because its grep of its own
stores found nothing, a corpus-scope miss. Its `hold-9636.md` now points here. Before refuting an
existence claim, ask the asserting party for the filename.
Related: [[project_12031_autodiff_ref_accessor_silent_wrong_grad]].
