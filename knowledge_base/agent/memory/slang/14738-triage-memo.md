---
type: triage
---
# Triage: shader-slang/slang#14738 — Non-void function with unmatched `__target_switch` compiles to empty body via generic
Date: 2026-11-27 | bug | high | P2 | IR (specialize-target-switch + missing-return); aspect 1 = dup of #13995

## What's broken
Two aspects:
1. **E36107 blind through generic/interface dispatch** — entry-point capability check doesn't see callee impls reached via interface-constrained generics. **Known gap, already tracked by open issue #13995** ("Generic interface calls omit concrete implementation capability requirements", labeled `reproduced`); disabled test `tests/diagnostics/capability-generic-interface-call.slang:3-4` awaits that fix. NOT fresh — do not fix here.
2. **FRESH: unmatched `__target_switch` in a value-returning function silently becomes an empty body** on CUDA/CPP (`__device__ bool f(int x) { }` — UB). Happens even via the direct path under `-ignore-capabilities`.

## Repro (VERIFIED on master 77e59ba7c, freshly rebuilt slangc, 2026-11-27)
File: issue body `ts_repro.slang` (copy at `/workspace/agent/.repro-14738/ts_repro.slang`).
- `slangc ts_repro.slang -target cuda -entry main_direct -stage compute` → error[E36107] exit=2 (expected, unchanged)
- `slangc ts_repro.slang -target cuda -entry main_generic -stage compute` → exit=0, emits `static __device__ bool positive_only_on_gpu_0(int x_0) { }` (empty body, no return, no diagnostic)
- Same silent empty body: `-target cpp`, and `main_direct -ignore-capabilities`.

## Codebase digest (file:line)
- `specializeTargetSwitch` — `source/slang/ir-passes/slang-ir-specialize-target-switch.cpp:12`. Target-incompatible cases skipped silently at `:41-42`; only `failedImplies` (same-family profile mismatch) errors E41011 `ProfileIncompatibleWithTargetSwitch` at `:78-85` (see `tests/bugs/gh-9509.slang:12`); **completely unmatched switch → silent `builder.emitMissingReturn()` at `:87`**, then DCE. Comment `:75-77` records the deliberately-tolerated pattern (`case metal: return;` void fn for glsl).
- `checkForMissingReturns` — `source/slang/ir-passes/slang-ir-missing-return.cpp:87`; `doesTargetAllowMissingReturns` `:18-26` returns false only for Khronos/WGPU → CUDA/CPP/HLSL/Metal "allow"; per-target invocation at `slang-emit.cpp:1781-1787` runs with `diagnoseWarning=false` (silent no-op on CUDA by design). 202c language → unconditional error `:35-39`.
- Frontend E36107: `validateEntryPointCapabilities` — `source/slang/semantic-checking/slang-check-shader.cpp:1885`, diagnose `:1922`; walk is AST-scope only (`getDeclRefCapabilityRequirements` `slang-check-decl.cpp:23042`); `q.query(x)` resolves to the requirement decl (empty caps), impl caps live in witness tables materialized at IR time (`specializeModule` `slang-emit.cpp:1643`), after capability checking. GenericAppDeclRef requirements skipped per `slang-check-shader.cpp:1790-1796`.
- Emit: C-like emitter has no `kIROp_MissingReturn` case — default "Don't do anything" `slang-emit-clike.cpp:3800-3805`.

## Candidate approaches (aspect 2 only)
### Approach A: Diagnose at the MissingReturn synthesis point (RECOMMENDED)
- Where: `slang-ir-specialize-target-switch.cpp:87` (the `else` branch: no case matched, no failedImplies).
- Delta: when the enclosing function's result type is non-void, emit a hard error (new diagnostic, e.g. "no case in `__target_switch` matches target 'cuda' in value-returning function"). Not a capability check → fires even under `-ignore-capabilities`. Void functions keep today's silent tolerance.
- Tradeoffs: `specializeTargetSwitch` walks ALL global code pre-DCE (`:100-108`), so dead non-void helpers with unmatched switches would newly error — small behavior change, but emitting a called non-void empty body is never valid; suite run over the 63 test files using `__target_switch` measures the blast radius.
- Risk: low-medium (narrow shape: non-void + zero matched cases).
### Approach B: Flip missing-return severity for non-void functions on all targets
- Where: `slang-ir-missing-return.cpp:18-26` / `:28-54`.
- Delta: every MissingReturn in a non-void fn (incl. plain fall-off-end) errors on CUDA/CPP/HLSL/Metal.
- Tradeoffs: broader breaking change vs. deliberately tolerated E41010 warning behavior; also gated behind non-essential-validations flags.
- Risk: medium-high (legacy code).
### Approach C: Emit-side rejection of empty non-void bodies in CUDA/CPP emitter
- Consumer-side patching of an IR-level gap — against repo methodology. Rejected.

## Recommended path
**A.** Fixer: in `specializeTargetSwitch` (`slang-ir-specialize-target-switch.cpp:87`), add a non-void check on the enclosing `IRGlobalValueWithCode` result type before `builder.emitMissingReturn()`; diagnose a new hard error there. Keep void-function behavior unchanged. Add a `//DIAGNOSTIC_TEST` regression test (repro file) under `tests/diagnostics/` or `tests/language-feature/capability/`. Cross-reference #13995 for aspect 1 (out of scope here; the disabled generic-call runs in `capability-generic-interface-call.slang` belong to that chain).
- Repro: `slangc ts_repro.slang -target cuda -entry main_generic -stage compute -o out.cu` (expect hard error, nonzero exit; today exit=0 with empty body).
- Accept when: (1) main_generic cuda/cpp → hard error; (2) main_direct unchanged (E36107); (3) void functions with unmatched switch still compile; (4) existing missing-return/E41010/E41009/E41011 tests and the 63 `__target_switch` test files pass unmodified except the new test.

## Sources
- DeepWiki Q&A 2026-11-27: generic-dispatch capability gap known (test comment "re-enable after #13995"); `specializeTargetSwitch` emits no diagnostic for fully-unmatched switch; CUDA/CPP missing-return warning-only pre-202c.
- #13995 (open, `reproduced`) — aspect 1 duplicate. #14738 aspect 2: no other duplicate found (searched "missing return", "unmatched target_switch", "empty body").
- Related prior: PR #14540 (require-on-static-members through generic types) touched adjacent capability-inference code — not a regression source.
