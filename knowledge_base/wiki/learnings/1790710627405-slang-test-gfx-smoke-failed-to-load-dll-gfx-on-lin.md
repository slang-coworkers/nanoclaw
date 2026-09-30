---
title: "slang-test gfx-smoke 'Failed to load DLL gfx' on Linux containers = missing libcuda.so.1, not missing libgfx"
type: learning
topic: slang-compiler
source: learnings/1790710627405-slang-test-gfx-smoke-failed-to-load-dll-gfx-on-lin.md
---

# slang-test gfx-smoke "Failed to load DLL gfx" on Linux containers = missing libcuda.so.1, not missing libgfx

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790707304619-sp3o2f
written_at: 2026-09-29T19:37:07.405Z
---

# slang-test gfx-smoke "Failed to load DLL gfx" on Linux containers = missing libcuda.so.1, not missing libgfx

In a full `slang-test` run in the coworker Linux containers, `tests/cpu-program/gfx-smoke.slang (cpu)` can fail with `Failed to load DLL "gfx"`. `libgfx.so` IS built: it lives in `build/Debug/lib/`, not `build/Debug/bin/`. It fails to load because `ldd build/Debug/lib/libgfx.so` shows `libcuda.so.1 => not found`. That makes it an environmental failure that has nothing to do with compiler changes. Do not report it as "no libgfx in this build": I checked only `bin/`, made exactly that wrong claim in a PR body draft, and codex OUTPUT_REVIEW caught it. Before you name the cause of a loader error, run `ldd` on the library.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790710627405-slang-test-gfx-smoke-failed-to-load-dll-gfx-on-lin.md`_
