---
title: "slang ci-examples.sh grades examples on exit code only — swallows warnings AND errors"
type: learning
topic: slang-compiler
source: learnings/1783471474036-slang-ci-examples-sh-grades-examples-on-exit-code-.md
---

# slang ci-examples.sh grades examples on exit code only — swallows warnings AND errors

**Context:** Triaging shader-slang/slang#11989 ("Example tests in CI should fail on any warning output"), filed by nv-slang-bot at @jkwak-work's request, motivated by #11985 (intermittent macOS CI). Verified @ HEAD 33f9ed0ce.

**Finding:** `.github/workflows/ci-examples.sh` `run_sample()` (@154-184) grades each example purely on process exit code (`./"$sample" ... || result=$?` @172; pass = `result -eq 0` @177). It NEVER scans stdout/stderr for compiler diagnostics. So an example can print `warning[...]`/`error[...]`/`fatal error[...]` and still be counted green. Invoked from ci-slang-test.yml @167-176 only on `full-gpu-tests && release && pull_request`, with `--skip-file tests/expected-example-failure-github.txt` (the skip mechanism = regex `<os>:<platform>:<config>:<sample>`, `skip()` @134-152 — the natural template for a diagnostics allowlist).

**Two offenders (both reproduced at HEAD, exit 0):**
1. `cpu-com-example` → `warning[E41017]: use of uninitialized global variable 'globalDoThings'`. This is arguably a FALSE POSITIVE: `globalDoThings` is `export __global __extern_cpp IDoThings` (shader.slang:5), a HOST-PROVIDED global resolved at runtime via `findSymbolAddressByName("globalDoThings")` (main.cpp:127); target = SLANG_SHADER_HOST_CALLABLE. An externally-provided extern global has no in-module initializer by design.
2. `reflection-api` → `error[E36108]: dependencies not compatible on target 'llvm'` + `error[E39999]` + `fatal error[E40003]`. **This is an ERROR/FATAL, not a warning** — so a gate keyed only on `warning[...]` would MISS it. The example swallows it because `compileAndReflectPrograms()`'s Result is DISCARDED (main.cpp:1488) and `execute()` always returns SLANG_OK (main.cpp:1490).

**Why E36108 cites 'llvm' when the example only targets DXIL/SPIRV:** `llvm` is an auto-available capability-target atom whenever `slang-llvm` is linked (build has libslang-llvm.so). The front-end capability check runs at `loadModule` per translation unit and considers `llvm` REGARDLESS of the session's TargetDesc list. `Texture2D.Sample` is GPU-only → incompatible on llvm. EMPIRICALLY: `slangc raster-simple.slang -entry fragmentMain -stage fragment -target spirv` STILL emits E36108/'llvm' (compute-simple.slang alone compiles clean, exit 0). Emit site: `SemanticsDeclCapabilityVisitor::diagnoseUndeclaredCapability` @slang-check-decl.cpp:21396. Both DeepWiki-corroborated.

**Recommended fix:** capture+grep+allowlist in ci-examples.sh (gate on `(warning|error|fatal error)\[[A-Za-z]*[0-9]+\]:`, NOT warning-only); allowlist the 2 offenders with justification (neither trivially example-fixable — both are arguable compiler false-positives); file 2 compiler-side follow-ups to de-allowlist later.

**Triage-state note:** issue was ALREADY human-triaged (assignee jkwak-work, Type=Testing, milestone Q3 2026, label "Dev Opened") — do NOT touch Type or existing labels; `reproduced` is additive/accurate. Label POST via API 403'd; `gh issue edit --add-label` worked (same trap as #11864).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783471474036-slang-ci-examples-sh-grades-examples-on-exit-code-.md`_
