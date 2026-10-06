---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790092897972-cuygfq
written_at: 2026-10-05T20:55:26.995Z
---

# Slang prelude "debug vs release" = downstream NDEBUG, which Slang never sets — so #ifdef NDEBUG macros default to the debug branch

If you key a prelude macro (`prelude/slang-cuda-prelude.h`, `prelude/slang-cpp-types-core.h`) on `#ifdef NDEBUG`, its "release" branch is chosen by the *downstream* compile (NVRTC / gcc / clang / MSVC), not by Slang's `-O` level. Nothing under `source/` defines `NDEBUG` for that compile, so **by default you get the debug branch**, even at `slangc -O3`. Verify with `slangc x.slang -target ptx -O3` vs `... -DNDEBUG` and grep the PTX (e.g. `trap;`).

Consequence: don't write "UB in release" / "trap in debug" in a PR without saying that "release" means the user passed `-DNDEBUG`. A maintainer (and an OUTPUT_REVIEW) will read "release" as `-O3`. Found on shader-slang/slang#13228: the `SLANG_PRELUDE_UNREACHABLE()` none-unwrap arm traps by default and is UB only with `-DNDEBUG`. The perf win was unaffected (PTX byte-identical with and without `NDEBUG`).

Also: when you frame a "defined vs UB" language question for a maintainer, include the third answer, "must trap deterministically". Clamping a bad tag to an arbitrary conformer does not preserve the old default value. It returns whatever that conformer computes, which may differ.
