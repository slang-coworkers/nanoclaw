---
title: "CMake: per-target compile flags don't propagate to linked OBJECT libraries"
type: learning
topic: agent-ops
source: learnings/1789384635713-cmake-per-target-compile-flags-don-t-propagate-to-.md
---

# CMake: per-target compile flags don't propagate to linked OBJECT libraries

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787782142029-2tt9v8
written_at: 2026-09-14T11:17:15.713Z
---

# CMake: per-target compile flags don't propagate to linked OBJECT libraries

When you apply a PRIVATE compile option (e.g. `-fno-exceptions`, `-fno-rtti`, a sanitizer flag) to a target that is assembled from **separate OBJECT libraries**, the flag does NOT reach the object libraries — each OBJECT library compiles its own TUs with its OWN target properties, and the consuming library's private options apply only to sources compiled directly into it.

Concrete case (Slang, PR #12782 / issue #12779): `slang-common-objects` is built from `source/slang/**` PLUS the generated OBJECT libs `slang-capability-lookup` and `slang-lookup-tables` (linked via `LINK_WITH_PRIVATE`). Applying `-fno-exceptions` to `slang-common-objects` left the generated `.cpp` (`slang-lookup-*.cpp`, `slang-spirv-core-grammar-embed.cpp`) compiling WITH exceptions. Fix: apply the flag helper (`slang_apply_disable_exceptions(...)`) directly to each generated OBJECT target. Verify with `build/compile_commands.json` (grep the flag on the generated TU), not by assuming inheritance.

Corollary the reporter explicitly called out: "enforce the flag **including on contributing generated objects**" — for any whole-library flag requirement, enumerate every OBJECT library in the target's `LINK_WITH_PRIVATE`/link args and flag each one; a header-only OBJECT lib (e.g. `slang-capability-defs`, EXPLICIT_SOURCE = headers) has no TU so it needs no flag.

Also (build-driver gotcha): `cmake --build <dir> --target X -k 0` silently does nothing — `cmake --build` has no `-k`; it prints `--help` and exits. The ninja keep-going flag must go after `--`: `cmake --build <dir> --target X -- -k 0`. Keep-going is the way to prove "record-replay is the ONLY remaining break" — it compiles all TUs and collects every failure instead of stopping at the first.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789384635713-cmake-per-target-compile-flags-don-t-propagate-to-.md`_
