---
name: project_12367_functype_kernel_emit_armed_cotrigger
description: "slang#12367 (functype reached 4 kernel emitters as an undefined type) — TERMINAL: PR #12378 (E55216 in checkUnsupportedInst, interim per jkwak/csyonghe) MERGED 2026-09-01 as f86f310. Spin-off #12372 (SPIR-V spirv-opt abort) still OPEN, re-triaged 09-04: SPIR-V was deliberately out of #12378's scope. Lessons: shape-gated check, merge-base-per-head diffstat, green-from-skipped CI."
metadata:
  node_type: memory
  type: project
  originSessionId: 9f9f7b0e-e9ed-4eb0-8ecf-7cff86871b38
---

# slang#12367 — `functype` reaches kernel emitters as an undefined type name

## Outcome (terminal, verified 2026-10-01)

- **PR #12378** "Diagnose function-typed values on targets that cannot represent them" — **MERGED 2026-09-01T07:15Z** as `f86f310b7c`; #12367 auto-closed `completed`.
- Shape: new **E55216** in `checkUnsupportedInst` (`slang-ir-check-unsupported-inst.cpp`), gated by `doesTargetSupportFuncTypedValue` (`:116-134`): kernel C++/CUDA/PTX, Metal, WGPU and the shared-lib / host-callable / LLVM-IR family diagnose. `HostCPPSource` is absent, so `[DllImport]` keeps working.
- **Interim by design.** jkwak-work (cmt `5198405565`): "a diagnostic error message for the targets that doesn't have the implementation until we have the implementations. Make a PR." csyonghe (cmt `5212908232`): `functype` is "mostly for core module's internal use … mark it as unsupported now"; cpp/cuda support "should be easy", other targets "might not be feasible". So the diagnostic is likely temporary for cpp/cuda and permanent for metal/wgsl.
- Known limitation stated in the PR: `checkUnsupportedInst` is skipped under `-minimum-slang-optimization` (`slang-emit.cpp:2737`), so the hole is closed at default optimization levels only.

## Spin-off #12372 — still OPEN

spirv-opt asserts (`ir_context.cpp:1106`) at default `-O` on a functype value; `-O0` silently emits invalid SPIR-V. jkwak-work asked for a re-triage after #12378 merged; our re-triage (2026-09-04, master `961e4e5`) found SPIR-V **deliberately** outside #12378's gate (`default:` returns true; in-code comment `:109-115` says SPIR-V is tracked separately). `-target cuda`/`wgsl` now give E55216; `-target spirv` still aborts. **Resume trigger:** any human comment on #12372. The triager's other queued spin-offs (`[DllImport]`+`hpp` SIGSEGV; func-typed return type SIGSEGV; the `-minimum-slang-optimization` gate question) are the triager's to file, not Main's.

## Root cause (for the record)

`slangc -target cuda` exited 0 and emitted `Slang_FuncType<int, int> gFn_0;`, which `nvcc` rejects. `specializeHigherOrderParameters` (`slang-emit.cpp:1429`) is best-effort: `slang-ir-specialize-function-call.cpp:267-268` returns `canSpecializeCall == false` and silently skips the call. Metal had a different producer (no `kIROp_FuncType` case in `slang-emit-metal.cpp`; it fell into the op-name fallback, emitting `Func`), so a CPP-only fix would have looked complete and wasn't. HLSL/GLSL fail earlier with `E99999` and were excluded and flagged. Not a regression: the emit case and host-only prelude definition landed together in `65c2e7f1c` (#2181, 2022). The 4-silent/2-loud target table was correct; a mid-chain "5/1 correction" measured an unpublished variant and was retracted — see [[feedback_a_correction_must_re_measure_the_published_input]].

## Durable lessons

- **Core-module safety came from the check's shape, not from specialization.** `hlsl.meta.slang` uses `functype` 20×, and 4 func-typed insts survive to check time. They do not fire because they are plain `^func` declarations: the pre-switch block tests `holdsFuncType` only on struct fields (`:341`) and `kIROp_GlobalVar` (`:357`), so a `kIROp_Func` never has its own type tested. Two other mechanisms ("they specialize away", "the switch dispatches on opcode before any type test") were both wrong while giving the same verdict. A verdict re-derived from three mechanisms is over-determined, not proof that any one mechanism is right; a claim about the check's shape survives a pass regression, a claim about a pass does not.
- **Never quote a stored diffstat — store the command.** The PR's diffstat moved three times (+419/10 → +424/10 → +564/16). To ask "did the contribution change across a rebase", diff **each head against its own merge-base** (`MB=$(git merge-base <ref> origin/master); git diff --shortstat $MB <ref>`); both heads gave +564/16 against different bases, which is a pure rebase. A two-head diff on a force-overwritten ref, a 3-dot compare between diverged commits (mixes upstream movement in), and per-file blob hashes all fail to answer it. Object availability (`git cat-file -t <sha>`) is a property of your own fetch history, not of the remote or a peer's clone. See [[feedback_a_control_validates_the_instrument_never_the_target]].
- **A green CI aggregate can be built from housekeeping over skipped builds.** On head `9482349972`, combined status was `success` with 41 skipped + 4 success (board-sync, reuse-compliance) and zero builds or tests. Cite which checks ran, never the aggregate; phrase public claims as the consequence ("CI has validated nothing yet"), which outlives the symptom ("red"). See [[feedback_green_job_skipped_backend_zero_coverage]].
- **"Free at master" is not "free".** Diagnostic 55215 was unused on master but claimed by unlanded PR #12249; #12378 correctly took 55216. Check open PRs before claiming a code.
- **`APPROVE_WITH_NITS` is a peer-internal verdict, not a GitHub review state** — never relay it upward as "approved".
- When two tiers are armed on one trigger, exactly one dispatches; parallel dispatch to the same peer mints duplicate sessions. Main stood down and let slang-triager (memo holder, last commenter) drive.
- After a human's last comment, post a **fresh** comment, not an in-place edit — an edit notifies nobody ([[feedback_an_in_place_edit_notifies_nobody]]).
