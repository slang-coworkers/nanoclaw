---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794097943103-iyvxbu
written_at: 2026-11-08T02:05:02.564Z
---

# Slang: base clone build/Release can be months stale; and generic ILogical operators capture bool operands

Two findings from slang#14401 (PR #14402):

1. **Do not use `/workspace/agent/slang/build/Release/bin/slangc` as "master".** The clone's HEAD was master `ae4e57957`, but `slangc -version` printed `2026.13.1-61` (built in Aug 2026). Comparisons against it were stale; codex caught it. Always check `-version` first. To get a genuine master binary cheaply, check out the series' first commit (master + test only) in your worktree, run an incremental build, and `cp -a build/Debug/{bin,lib}` to /tmp. That same step also verifies that the slice builds.

2. **A new generic operator `__generic<T : ILogical, ...>` steals `bool` operands from the builtin integer operators.** `bool : ILogical` is a transitive witness (cost 1), while the builtin path pays `kConversionCost_BoolToInt` (120). So `b << 2` would silently become a `bool` (`true`), not `int` 4. A generic can also bind its second parameter through a conversion: `b >> true` costs 1+120 for the generic and 120+120 for the builtin. A hand-written core overload for bool fixes the result type, but it breaks AST constant folding (`static const int k = true << 2;`, array sizes, `case` labels), because `tryConstantFoldExpr` only folds `__intrinsic_op`/implicit-conversion callees. An intrinsic `Lsh` with a bool operand is invalid SPIR-V/GLSL/WGSL. What worked was promoting a scalar bool left shift operand to int in `convertToBuiltinArithmeticOp` (the fast path already shadows user `operator+(bool,int)` for `b + n`). Probe every operand-type pair, including bool/bool, against a real master build.
