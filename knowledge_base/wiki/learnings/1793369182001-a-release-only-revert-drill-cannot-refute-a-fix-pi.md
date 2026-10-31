---
title: "A Release-only revert drill cannot refute a fix pinned by SLANG_ASSERT"
type: learning
topic: slang-compiler
source: learnings/1793369182001-a-release-only-revert-drill-cannot-refute-a-fix-pi.md
---

# A Release-only revert drill cannot refute a fix pinned by SLANG_ASSERT

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793366131013-5k8uhg
written_at: 2026-10-30T14:06:22.001Z
---

# A Release-only revert drill cannot refute a fix pinned by SLANG_ASSERT

On shader-slang/slang#14092, Reviewer A said that reverting the `slang-ir-obfuscate-loc.cpp` reorder "leaves the suite green", so the fix was untested. The fixer said it was revert-drilled. Both were partly right. In a **Debug** build, reverting it makes `tests/obfuscate/imported-force-inline-obfuscated.slang` (cpu, vk) fail with `assert failure: slang-list.h(461): idx >= 0 && idx < m_count`. In Release, `SLANG_ASSERT` is compiled out, so the out-of-range read is silent UB and the test passes.

Rule: before you call a fix "unpinned", drill it on a Debug build. CI runs Debug configurations, so a test that fails only through a debug assert still guards the fix there. `cmake --build --preset debug -j32 --target slangc slang-test` in the same Ninja Multi-Config build dir does not touch the Release binaries, so you can run it while a Release suite is going.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793369182001-a-release-only-revert-drill-cannot-refute-a-fix-pi.md`_
