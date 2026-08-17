---
title: "Slang LLVM backend: 'plugin absent' and 'target genuinely unsupported' emit the SAME diagnostic (E00028) — the same absence-vs-rejection conflation as the SPIR-V validator path"
type: learning
topic: slang-compiler
source: learnings/1785835977515-slang-llvm-backend-plugin-absent-and-target-genuin.md
---

# Slang LLVM backend: "plugin absent" and "target genuinely unsupported" emit the SAME diagnostic (E00028) — the same absence-vs-rejection conflation as the SPIR-V validator path

# Absence and rejection are indistinguishable in the LLVM codegen path

Verified at `shader-slang/slang` @`ba156ebf5c900ff89189c15347bafded7b4280ee`
while deciding PR #12322. This is a **standing, still-open** repo property, not a
defect introduced by that PR.

## The finding

`Diagnostics::UnableToGenerateCodeForTarget` — error **E00028**, message
`unable to generate code for target '<target>'`
(declared `source/slang/slang-diagnostics.lua:276`) — is emitted for two
*semantically different* causes:

- **Backend ABSENT** (the `slang-llvm` shared library is not loadable):
  - `source/slang/slang-emit-llvm.cpp:697-704` — `getOrLoadSlangLLVM()` returns
    null in `init()`;
  - `source/slang/slang-emit.cpp:3590-3596` — same check in
    `emitLLVMForEntryPoints`.
- **Target genuinely REJECTED** (no source emitter exists for the target):
  - `source/slang/slang-emit.cpp:2862-2867` — `if (!sourceEmitter)`.

One diagnostic, two causes, no distinguishing text. A caller cannot tell
"install the plugin" from "this target is not supported".

## Why it matters — the concrete failure it produced

`tests/language-feature/coverage/coverage-llvm-skip.slang` compiles with
`-target host-callable -emit-cpu-via-llvm` and asserts warning **E45102**
(coverage instrumentation unsupported on LLVM CPU targets, emitted by
`instrumentCoverage` in `source/slang/slang-ir-coverage-instrument.cpp`).

On a runner without `slang-llvm`, slangc bails at the absence check **before**
reaching the coverage pass, so E45102 never appears and the test fails with:

```
Expected substring: "warning E45102"
Actual diagnostics: "unable to generate code for target 'host-callable'"
```

The failure text gives no hint that a *plugin* was missing — which is exactly the
diagnostic-opacity cost of the conflation.

## Same class as the SPIR-V validator failure mode

This is structurally identical to the known validator-availability failure mode
(`source/compiler-core/slang-glslang-compiler.cpp:359-371`,
`source/slang/slang-emit.cpp:3430-3438`), where SPIR-V validation returns the
same failure for "validator absent" as for "validator rejected the shader" — the
mode that produced a silent `0/866` score with zero diagnostic text. **Both share
one root cause: an availability failure and a semantic rejection collapsed onto a
single result/diagnostic.** A fix at the "distinguish absent from rejected"
layer would address both.

## The in-tree precedent for the RIGHT shape

`render-test`'s `-render-features` gate is **two-stage**
(`tools/render-test/options.cpp:157-165`): an unknown feature *name* is a loud
`SLANG_FAIL`, while an unsupported *device* is a silent `IGNORED`. That shape
distinguishes "directive mis-wired / typo" from "genuinely unavailable", so a
regressed pin reddens instead of silently dropping coverage. Robust by
construction; worth copying when adding any availability gate.

## How PR #12322 relates (and why it is not the fix)

#12322 routes *around* the conflation one layer up: it teaches `slang-test` that
`-emit-cpu-via-llvm` implies a requirement on `SLANG_PASS_THROUGH_LLVM`
(`tools/slang-test/slang-test-main.cpp:1531`, `:4656`), so the pre-existing gate
`_canIgnore` (`:4940-4944`) reports such tests `Ignored` rather than running them
into the opaque failure. That is a legitimate harness-layer fix for a harness
problem — the test genuinely does require LLVM — but it leaves the
compiler-layer diagnostic ambiguity untouched. Anyone landing on E00028 outside
slang-test still cannot tell absence from rejection.

## Practical note for anyone gating on backend availability

Two *different* loaders probe LLVM, and it is worth knowing they agree:
- availability gate: `checkPassThroughSupport` → `checkExternalCompilerSupport`
  (`source/slang/slang-global-session.cpp:1279-1290`) → `locateCompilers`
  (`source/compiler-core/slang-llvm-compiler.cpp`) →
  `findFuncByName("createLLVMDownstreamCompiler_V4")`;
- codegen: `getOrLoadSlangLLVM` (`slang-global-session.cpp:1266-1277`) →
  `findFuncByName("createLLVMBuilder_V3")`.

Both load the library named `"slang-llvm"`, and `cmake/LLVM.cmake:56-72` builds
`source/slang-llvm` as ONE `MODULE` target containing both entry points
(`slang-llvm.cpp:1059`, `slang-llvm-builder.cpp:2396`) — so gate-says-present /
codegen-fails would require a partially-exported library, which this build does
not produce. **The general move when auditing any availability gate: check
whether the gate's probe and the guarded work resolve the same artifact. Two
distinct loader functions is the tell that they might not.**

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785835977515-slang-llvm-backend-plugin-absent-and-target-genuin.md`_
