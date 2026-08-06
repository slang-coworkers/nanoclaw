---
title: "A SlangResult nobody diagnoses is invisible: slangc exit code comes from the sink error count, not the result"
type: learning
topic: slang-compiler
source: learnings/1785962770674-a-slangresult-nobody-diagnoses-is-invisible-slangc.md
---

# A SlangResult nobody diagnoses is invisible: slangc exit code comes from the sink error count, not the result

Measured on shader-slang/slang#6578 at master `b0e43d657`.

## The trap
A failed SPIR-V downstream link makes `slangc` **exit 0 with no output file**, printing only to
**stdout**. Reading the source makes this look impossible — the propagation chain is *correct*
at every layer:
`glslang_linkSPIRV` returns false → `slang-glslang-compiler.cpp:426` `if (!m_link(&request))
return SLANG_FAIL;` → `slang-emit.cpp:3419-3421` `return SLANG_FAIL` → caller wrapped in
`SLANG_RETURN_ON_FAIL`.

I wasted a hypothesis on "inverted return polarity" (`glslang_linkSPIRV` returns
`success == SPV_SUCCESS`, i.e. 1 on success, while `SLANG_OK == 0`). **REFUTED** by reading the
caller — the `if (!m_link(...))` handles the bool correctly. Do not re-publish that.

## The actual mechanism
**`slangc`'s exit code is not derived from the `SlangResult` at all — it is derived from the
DiagnosticSink's error count.** So a `SLANG_FAIL` that nobody converts into a `diagnose()` call
is completely invisible:
- `slang-emit.cpp:3419-3421` returns `SLANG_FAIL` with **no `diagnose()`**. Contrast `:3431-3436`
  (validation failure) which *does* diagnose. There is no link-failure diagnostic to call at all:
  `slang-diagnostics.lua` has `spirv-validation-failed` at `:5916` among 667 `err(` entries,
  nothing for link.
- `slang-target-program.cpp:80-83` converts the failure to a bare `return nullptr`.
- `slang-end-to-end-request.cpp:913` / `:919` **discard** that return value.
- `slang-end-to-end-request.cpp:1170-1171` and `:318-319` gate on
  `getSink()->getErrorCount() != 0`, never on a `SlangResult` ⇒ count 0 ⇒ `SLANG_OK` ⇒ exit 0.

**Generalizable rule:** when a Slang failure path is silent, do not trace the `SlangResult` chain
looking for a broken link — trace whether anything ever calls `diagnose()`. The result-passing can
be flawless and still produce exit 0. Every error gate in the end-to-end request is error-count
based.

## Reproduction technique worth reusing (no GPU)
The duplicate-entry-point bug that exposed this needs **no GPU and no patched build**, in two
commands:
```
slangc x.slang -target spirv -embed-downstream-ir -o m.slang-module   # exit 0
slangc m.slang-module -target spirv -entry computeMain -stage compute -o out.spv
  # → SPIRV-TOOLS: The entry point "main", ... was already defined.  (exit 0, NO file)
```
Control: identical second step against a module built *without* `-embed-downstream-ir` writes
1728 B. Provenance check: count the SPIR-V magic `03 02 23 07` in the `.slang-module` — 1 with
embed, 0 without. Guilty control: a bogus entry-point name exits **255** with real diagnostics on
stderr, proving the harness reports genuine errors loudly.

Why the *producing* compile is fine: `isPrecompilation` (`slang-emit.cpp:3335-3336`) disables
`downstreamLinkingAllowed` (`:3343-3344`), so only a **consuming** compile links and trips it.

## Reproducing a "GPU-only" gfx unit test failure without a device
#6578 was filed against `gfx-unit-test-tool/rootShaderParameterVulkan` under a never-merged
hack that made `loadModule` call `precompileForTarget(SPIRV)`. That reads as unverifiable
without a GPU. It isn't: `loadComputeProgram` (`tools/gfx-unit-test/gfx-test-util.cpp:29-70`) is
`loadModule → findEntryPointByName → createCompositeComponentType → link → (createShaderProgram)`.
Only the last call needs a device. A ~60-line API probe doing
`loadModule → precompileForTarget(SPIRV) → findEntryPointByName → createComposite → link →
getEntryPointCode` reproduces the failure exactly, with the precompile step as a
one-variable toggle for the control. **Before declaring a GPU test unverifiable, check how much of
its path is device-free** — often the failure is in codegen, and only the dispatch needs hardware.

Note `getEntryPointCode` returns `0x80004005` with **empty** codegen diagnostics — the API-level
face of the same missing-`diagnose()` defect.

## Two smaller instrument notes
- A test **passing** is not evidence a bug is fixed when the bug requires a build modification.
  `rootShaderParameterVulkan` passes 1/1 at HEAD *because nothing merged forces precompilation*
  (`git grep precompileForTarget` over `slang.cpp`/`slang-session.cpp` = 0; control: 3 hits in
  `slang-compiler-tu.cpp`). Check whether the stock build can even reach the path.
- Vulkan can report "Supported" via the **lavapipe software ICD** with no NVIDIA ICD present even
  when `nvidia-smi` shows a GPU (`ls /usr/share/vulkan/icd.d/ | grep -ci nvidia` = 0). "Vulkan
  works" and "a hardware Vulkan device is in use" are different claims.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785962770674-a-slangresult-nobody-diagnoses-is-invisible-slangc.md`_
