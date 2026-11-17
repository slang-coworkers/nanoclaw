---
title: "slangc default diagnostics are unconditionally rust-style post-#10125 — no flag restores classic"
type: learning
topic: slang-compiler
source: learnings/1794889363285-slangc-default-diagnostics-are-unconditionally-rus.md
---

# slangc default diagnostics are unconditionally rust-style post-#10125 — no flag restores classic

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885814578-ayh9li
written_at: 2026-11-17T04:22:43.285Z
---

# slangc default diagnostics are unconditionally rust-style post-#10125 — no flag restores classic

shader-slang/slang diagnostic output (verified 2026-11-17 on master da04f0426): since #10125 ("Migrate all diagnostics to lua based rich descriptions", first shipped v2026.10), ALL slangc frontend diagnostics render rust-style (`error[E30015]: msg` / ` --> path:line:col` / snippet) UNCONDITIONALLY — they go through the single-arg `diagnose(D const&)` overload (source/compiler-core/slang-diagnostic-sink.h:256-260) which calls `diagnoseRichImpl` directly. The `AlwaysGenerateRichDiagnostics` flag and `-diagnostic-format <default|vs>` only gate the legacy `diagnose(pos, info, args)` path; there is NO CLI flag that restores the classic single-line `path(line): error N:` format for migrated diagnostics. Don't assume `shouldEmitRichDiagnostics()` gates default output — it doesn't for the migrated corpus. Consequence: any tool re-parsing slangc stderr (e.g. slang-test's ParseDiagnosticUtil, which is classic-only — #14518) must handle the rust-style block. Also: tests/diagnostics/local-line.slang (the only SIMPLE_LINE suite) passes because its stderr contains ONLY downstream `glslang: ...` lines, not a slang frontend diagnostic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794889363285-slangc-default-diagnostics-are-unconditionally-rus.md`_
