---
title: "Slang parser-diagnostic gotchas: message dedup, body-phase error suppression, DIAGNOSTIC_TEST exhaustive rows"
type: learning
topic: slang-compiler
source: learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md
---

# Slang parser-diagnostic gotchas: message dedup, body-phase error suppression, DIAGNOSTIC_TEST exhaustive rows

From fixing shader-slang/slang#11664 (rejecting `operator+` as a variable/param name). Three non-obvious things that cost cycles:

**1. A diagnostic with no per-instance content gets DEDUPED across occurrences.** The diagnostic sink collapses diagnostics that are identical in (code + message). My first message was generic ("an 'operator' name can only be used to declare a function...") — so a file with two such errors reported only ONE. Fix: embed an instance-specific token, e.g. the operator symbol via `~op` in the .lua message + `.op = declaratorInfo.nameAndLoc.name->text` at the diagnose site (this is exactly why the existing `invalid-operator` diagnostic carries `~op`). Distinct messages → no dedup → all errors surface. Rule of thumb: any new diagnostic that can fire multiple times in one compile should interpolate something that differs per occurrence.

**2. A declaration-HEADER parse error suppresses function-BODY-phase errors.** Slang parses declaration headers eagerly and function bodies in a later phase. If ANY function has a header error (e.g. a malformed PARAMETER), the compiler skips the body-parse phase, so errors that only fire while parsing a function BODY (e.g. a malformed LOCAL variable in a different function) are silently dropped in that combination. Verified: lone local-var error reports fine; two local vars report; global-var + param report; but param + local-var reports ONLY the param. Implication for tests: don't mix a parameter-error case and a local-variable-error case in one diagnostic-test file expecting both — use a GLOBAL variable (same CompleteVarDecl code path, header phase) alongside the param so both report deterministically.

**3. DIAGNOSTIC_TEST:SIMPLE(diag=PREFIX) mechanics.** Runs `slangc <file> -enable-machine-readable-diagnostics` (no target/entry needed; front-end parse+check only). With `diag=` set, the harness uses inline `//PREFIX:` annotations and IGNORES any `.expected` file. Exhaustive mode (default) requires EVERY emitted diagnostic row to be matched. Each error emits TWO rows in the machine-readable output: a primary row whose message is the diagnostic's SHORT TITLE, and a span row whose message is the SPAN message — and the span is only deduped if its message == the title. So a single error usually needs TWO `//PREFIX:` lines (one matching the title, one the span). `//PREFIX: E20020` substring-matches the error code on any row; `//PREFIX: <span text>` matches the span. Add `non-exhaustive` to the directive to skip the all-rows requirement.

**Bonus build tip:** for parser/diagnostics/front-end fixes that don't touch DXIL/HLSL codegen, configure with `cmake --preset default -DSLANG_ENABLE_DXIL=OFF` and build `--target slangc slang-test`. This skips the DXC dependency entirely — important on hosts where the DXC prebuilt is unusable (e.g. system GLIBC < 2.38) and would otherwise trigger a ~30-min DXC-from-source build.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781826649693-slang-parser-diagnostic-gotchas-message-dedup-body.md`_
