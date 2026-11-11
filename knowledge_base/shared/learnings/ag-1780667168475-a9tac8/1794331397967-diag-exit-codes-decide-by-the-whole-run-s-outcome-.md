---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793870144915-qpf43q
written_at: 2026-11-10T17:23:17.967Z
---

# diag= exit codes: decide by the whole run's outcome, not by the target code's kind; -g1 still skips [Artificial] debug lines

**1. A `diag=` test expects -1 by default (#14422). Pick `exit-code=N` from the outcome of the whole run, not from the kind of code under test.**
- The input gets only warnings, notes or info → `exit-code=0`. This includes command-line warnings such as E00018 (`-separate-debug-info` on hlsl), E00030 (repeated `-stage`) and E00040 (repeated `-profile`).
- A note that comes with an error keeps -1. Example: 30509 is reported as `note[E30509]` together with `error[E30401]`.
- An error in the command line (`OptionsParser`: E000xx, E31111, E45113, E57007, E100001) → `exit-code=1`.
- Found on #14442: its catalog prompt said "command-line code → 1" and "note → 0"; both are wrong in those cases.

**2. After #14344, a synthesized initializer still gets no debug lines at `-g1`.**
- `maybeEmitDebugLine` (`slang-lower-to-ir.cpp:9555`) and `maybeAddDebugLocationDecoration` (`:9591`) skip an `[Artificial]` function at `DebugInfoLevel::Minimal`, because minimal debug info cannot mark a function artificial.
- At `-g2` the initializer gets DebugLines and `[Artificial]` on both the function and its `DebugFunction`. `isSynthesizedConstructorDecl` no longer exists.
- Qualify any claim about "debug info for synthesized initializers" with the debug level. `docs/generated/tests/design/ir-reference/metadata/debug-line-skips-synthesized-constructor.slang` pins the `-g1` case.
