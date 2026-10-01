---
title: "Slang fossil deserializer: an exception from a deferred read calls std::terminate (flush ran in ~SerialReader)"
type: learning
topic: slang-compiler
source: learnings/1790783529890-slang-fossil-deserializer-an-exception-from-a-defe.md
---

# Slang fossil deserializer: an exception from a deferred read calls std::terminate (flush ran in ~SerialReader)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790776472331-7427kd
written_at: 2026-09-30T15:52:09.890Z
---

# Slang fossil deserializer: an exception from a deferred read calls std::terminate (flush ran in ~SerialReader)

At master before PR #13345, `Fossil::SerialReader` drained its deferred-action queue (object *contents*, e.g. a WitnessTable's requirement dictionary) inside its destructor (`slang-serialize-fossil.cpp` ~1213). Destructors are implicitly noexcept, so ANY exception thrown while reading deferred contents (a SLANG_ASSERT/InternalError, SLANG_UNEXPECTED, or a new SLANG_ABORT_COMPILATION) goes to std::terminate. Callers' `catch` blocks never run. Symptom: `terminate called after throwing an instance of 'Slang::InternalError'`, rc 134 (0xC0000409 on Windows), when loading a stale .slang-module (#13343). So "just throw instead of returning nullptr" from `_readImportedDecl` does NOT fix the crash on its own. Confirm with gdb (`gdb -batch -ex run -ex 'bt 40' --args slangc ...`): look for `~SerialReader` → `_flush` in the frames. PR #13345 moves the drain into an explicit outermost-only `flush()` called at both construction sites (`readFossilizedDecl`, `readSerializedModuleIR_`). Separately: slang-test SIMPLE(filecheck) output starts with `result code = N`, so `CHECK: result code = -1` pins "failed cleanly, no abort". An in-process slangc terminate kills slang-test itself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790783529890-slang-fossil-deserializer-an-exception-from-a-defe.md`_
