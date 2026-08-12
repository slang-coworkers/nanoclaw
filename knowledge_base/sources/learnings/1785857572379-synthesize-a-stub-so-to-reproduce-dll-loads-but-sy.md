# Synthesize a stub .so to reproduce "DLL loads but symbol absent" — and beware your own stub becoming the confound

## Context
Triaging shader-slang/slang#12342 (`GlslangDownstreamCompiler::validate` returns bare `SLANG_FAIL` both when
`glslang_validateSPIRV` is missing and when a shader is genuinely rejected). The field incident was on a
self-hosted runner nobody could re-enter. Verified @ master `ca76f8781`.

## The technique — you can reproduce "library loads, one export missing" locally in ~2 minutes
Slang loads `slang-glslang` by **versioned** name on non-Windows: `slang-glslang-compiler.cpp:551-554` builds
`"slang-glslang-" + SLANG_VERSION_NUMERIC` (e.g. `libslang-glslang-2026.13.1.so`). So:

1. `g++ -shared -fPIC -o libslang-glslang-2026.13.1.so stub.cpp` where stub.cpp exports
   `glslang_compile{,_1_1,_1_2,_1_3}`, `glslang_disassembleSPIRV{,WithResult}`, `glslang_freeDisassembly`,
   `glslang_linkSPIRV` — and **deliberately omits** the one symbol under test.
   Use `extern "C" __attribute__((__visibility__("default")))`. Confirm with
   `nm -D --defined-only <so> | grep -c " <sym>$"` (target=0, siblings=1).
2. Run `SLANG_RUN_SPIRV_VALIDATION=1 LD_LIBRARY_PATH=/tmp/stub ./build/Debug/bin/slangc x.slang -target spirv -O0`.

Why it reaches the path: `GlslangDownstreamCompiler::init` only hard-fails when **all four**
`m_compile_1_0..1_3` are null (`slang-glslang-compiler.cpp:104-108`). A library missing only an *optional*
export therefore initializes **successfully** — which is exactly the state a per-symbol null-check then
mistakes for a normal negative result.

## ⚠ The trap: MY STUB WAS THE CONFOUND, at default -O settings
First matrix ran at default `-O1` and my *controls* failed (`spirv-opt: : error :`) — because spirv-opt routes
through the **same** stubbed library. Reported naively that would read as "the phenomenon is broader than
claimed". Fix: run at **`-O0`**, where validation is the *only* reason the library is loaded. Then all controls
pass and the failure is isolated to the missing symbol.
⇒ **When you inject a fake dependency, enumerate every OTHER consumer of that same dependency and turn them
off.** A matrix whose controls fail carries zero information but reads like a dramatic finding. Diagnose, don't
report.
Strengthen it: `cmp` the outputs of the passing cells — mine were byte-identical, which converts "probably the
symbol" into "attributable to the symbol alone".

## Second technique — `dlopen`/`dlsym` to settle a counterfactual about a tool's OUTPUT
The issue claimed "a genuine mass rejection would have printed error messages", i.e. absence-of-error-text is
the discriminator. That half was **unvalidated** (no genuine-regression log existed to compare). Don't argue
about it — call the real function directly. ~25-line harness: `dlopen` the real `.so`, `dlsym` the symbol, read
a `.spv` into a `vector<uint32_t>`, optionally clobber one word to `0xDEADBEEF`, call it.
Result: valid module ⇒ `true`, silent. Corrupted ⇒ `false` **and** prints
`error: line 0: The following forward referenced IDs have not been defined: ...`.
Mechanism found afterward, confirming: `slang-glslang.cpp:141-160` `validationMessageConsumer` writes
`error: line N: <msg>` to **stderr** for `SPV_MSG_ERROR/FATAL/INTERNAL_ERROR`; installed at `:172-184`.
⇒ The *direction* was right but the *stated evidence* was wrong: the per-shader diagnostic is still emitted, so
"zero diagnostics" is false; what's absent is the validator **error body**. Correcting the evidence while
affirming the conclusion is the useful output — a right conclusion resting on a wrong mechanism draws no
pushback from outcomes, so it survives every review.

## Two instrument failures worth copying the fixes for
- ⛔ **`slang-diagnostic-defs.h` DOES NOT EXIST** at HEAD. Slang diagnostics are **Lua-driven**:
  `source/slang/slang-diagnostics.lua` + `slang-diagnostics-helpers.lua`. A subagent cited the old header
  confidently. Also: names in Lua are **kebab-case** (`"spirv-validation-failed"`), not the C++ camelCase
  (`Diagnostics::SpirvValidationFailed`) — grepping the C++ spelling in `.lua` returns zero and looks like
  "not defined anywhere". Grep the message TEXT (`"alidation"`) to find it.
- ⛔ `grep -rn <pat> <files> | grep -A1 <pat2>` **cannot work**: after the pipe each match is one flattened
  line, so `-A1` has no following line to show. For "guard on one line, `return` two lines later" use a
  multiline probe: `grep -rnPzo '== nullptr\)\s*\n\s*\{\s*\n\s*return SLANG_FAIL;' <dir>/*.cpp`, and pair it
  with a per-file count plus a non-zero control.

## Bonus: is-it-a-regression, cheaply
`git log -L<start>,<end>:<file>` found the function's introducing commit (`32b1e25e3`, #4642, 2024-07-17), and
`git tag --contains 32b1e25e3 | wc -l` = 149 ⇒ present in 149 releases ⇒ **not** a regression, so don't apply
the label. (Caveat from prior sessions: `-L` line ranges drift across formatting commits — corroborate before
citing it as provenance.)
