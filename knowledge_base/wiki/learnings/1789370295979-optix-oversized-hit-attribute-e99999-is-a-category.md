---
title: "OptiX oversized hit-attribute E99999 is a category-only bug, and its own repro may not fire (per-leaf count)"
type: learning
topic: slang-compiler
source: learnings/1789370295979-optix-oversized-hit-attribute-e99999-is-a-category.md
---

# OptiX oversized hit-attribute E99999 is a category-only bug, and its own repro may not fire (per-leaf count)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789369568940-je68d6
written_at: 2026-09-14T07:18:15.979Z
---

# OptiX oversized hit-attribute E99999 is a category-only bug, and its own repro may not fire (per-leaf count)

shader-slang/slang#13048 (triaged 2026-09-14, HEAD a90dfa311): an OptiX hit-attribute struct exceeding 8 32-bit attribute registers is diagnosed via `Diagnostics::Unexpected` → `internal error[E99999]` instead of a user `err`. Source: `slang-ir-legalize-varying-params.cpp:2419-2441` (`createLegalUserVaryingValImpl`, HitAttributes case) — `if (ioBaseAttributeIndex > 8)` at `:2428` → `m_sink->diagnose(Diagnostics::Unexpected{..., .location = m_param->sourceLoc})` at `:2433-2437`. Note the **source loc is already correct** (caret at the param); only the diagnostic *category* is wrong (internal vs user err). Fix = a new `err(...)` in `slang-diagnostics.lua` (model `shader-terminating-intrinsic-in-noninlinable-callee`=55214, an RT-legalization err already emitted from this same file), reusing the existing loc, keeping `SLANG_RELEASE_ASSERT(m_param)`.

TRIAGE LESSON (verify a reporter's minimal repro empirically): the issue's stated repro `struct { double values[5]; }` does NOT reproduce at HEAD. The attribute register count is **per scalar leaf and width-unaware** (`emitOptiXAttributeFetch` +1 per IRBasicType leaf regardless of byte width, `:2169-2171` — this is the sibling bug #13047), so 5 doubles = 5 registers ≤ 8 and compiles (each double truncated to 32 bits). The reporter's byte-size intuition (5 doubles = 40 bytes > 32) doesn't match the compiler's leaf count. A struct with >8 scalar leaves — e.g. `float values[9]` — reproduces the E99999 now, and is the stable regression-test case. `double values[5]` only reaches the >8 path once #13047 makes counting width-aware (10 registers). This is a GPU-free compile-time diagnostic (`slangc -target cuda -stage closesthit`), so it IS locally reproducible despite being an OptiX issue.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789370295979-optix-oversized-hit-attribute-e99999-is-a-category.md`_
