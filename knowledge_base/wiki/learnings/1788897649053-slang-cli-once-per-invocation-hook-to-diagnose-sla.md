---
title: "Slang CLI: once-per-invocation hook to diagnose slang-module production"
type: learning
topic: slang-compiler
source: learnings/1788897649053-slang-cli-once-per-invocation-hook-to-diagnose-sla.md
---

# Slang CLI: once-per-invocation hook to diagnose slang-module production

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788896887117-8nf27k
written_at: 2026-09-08T20:00:49.053Z
---

# Slang CLI: once-per-invocation hook to diagnose slang-module production

When you need to emit a diagnostic **exactly once, only when `slangc` is producing a compiled `.slang-module`/`.slang-lib` container** (and NOT on SPIR-V/HLSL/etc. target compiles, and NOT during the compiler's own core-module bootstrap), the hook is the guarded block in `EndToEndCompileRequest::maybeCreateContainer()`:

`source/slang/slang-end-to-end-request.cpp:1006` — `if (m_emitIr && (m_containerFormat == ContainerFormat::SlangModule))` → `writeContainerToStream(&stream)` (def :937).

That block already emits a **locationless** diagnostic (`getSink()->diagnose(Diagnostics::UnableToCreateModuleContainer{})` at :1012), so `getSink()` is right there and a locationless warning is a one-line add — the perfect model for style. The `.slang-module`/`.slang-lib` extension is what sets `m_emitIr` + `SLANG_CONTAINER_FORMAT_SLANG_MODULE` back in `OptionsParser::addOutputPath` (`slang-options.cpp:1907-1923`).

Do NOT hook the deeper `SerialContainerUtil::write(Module*)` (`slang-serialize-container.cpp:386`) for a user-facing warning — it also fires on the host API (`IModule::serialize`/`writeToFile`), the core-module bootstrap save (`slang-global-session.cpp:604`), and embedded precompiled IR, so it's noisy and hits the wrong audience.

Diagnostics are now defined in Lua (`source/slang/slang-diagnostics.lua`, `warning(name, code, message, primary_span, ...)` — helpers :442), NOT the old `slang-diagnostic-defs.h`. Kebab name → `Diagnostics::PascalCase`; codes are bucket-ranged and uniqueness-enforced (pick a FREE code, not max+1). Model for a "feature not frozen/stable" warning: `warning "inheritance-unstable"` code 30816 (`slang-diagnostics.lua:3788`). Warnings are suppressible via `-warnings-disable <code>`; keep in the always-on `default` group.

Context: triage of shader-slang/slang#12966 (warn that the .slang-module format is not frozen). Also note: the module format's "unversioned" reputation is nuanced — container envelope + serialized AST payload carry no format-version field, and the IR `serializationVersion` (checked on load at slang-serialize-ir.cpp:813) has never been bumped past 1; the semantic `IRModule::m_version` is read but not numerically range-enforced.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1788897649053-slang-cli-once-per-invocation-hook-to-diagnose-sla.md`_
