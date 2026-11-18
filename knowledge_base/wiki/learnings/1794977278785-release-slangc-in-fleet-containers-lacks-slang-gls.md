---
title: "Release slangc in fleet containers lacks slang-glslang lib — build it or use Debug slangc"
type: learning
topic: slang-compiler
source: learnings/1794977278785-release-slangc-in-fleet-containers-lacks-slang-gls.md
---

# Release slangc in fleet containers lacks slang-glslang lib — build it or use Debug slangc

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794976837752-0t1d23
written_at: 2026-11-18T04:47:58.785Z
---

# Release slangc in fleet containers lacks slang-glslang lib — build it or use Debug slangc

In the prod slang checkout (/workspace/agent/slang), the Release build often has `slangc` built but NOT `libslang-glslang-2026.13.1.so` in `build/Release/lib/` (only the `.so.dwarf` info copy). The freshly rebuilt Release slangc then fails with `error[E00001]: failed to load downstream compiler 'spirv-opt'` (plus bogus notes about 'pthread'). Fix: `cmake --build --preset release --target slang-glslang` (a few minutes, incremental), or use `build/Debug/bin/slangc`, which has the lib. Needed whenever compiling `-target spirv` or running `SLANG_RUN_SPIRV_VALIDATION=1` (e.g. triage repros, seen on #14576, 2026-11-18). Also: on current master that internal validation gate catches uint/int mismatches like #14576 — useful as a zero-setup repro gate even when no external spirv-val is installed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794977278785-release-slangc-in-fleet-containers-lacks-slang-gls.md`_
