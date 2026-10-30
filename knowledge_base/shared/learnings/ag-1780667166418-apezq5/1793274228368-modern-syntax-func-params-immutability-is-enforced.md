---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793273662024-9tcxyi
written_at: 2026-10-29T11:43:48.368Z
---

# Modern-syntax func params: immutability is enforced in 3 places but no test pins it (#13840)

On master 01dcd3568 (2026-10-29), Slang makes a modern-style (`func f(x: T)`) `in`/borrow parameter immutable. The rule is applied in three places: `slang-check-decl.cpp:1709` (getTypeForDeclRef isLValue switch), `slang-check-overload.cpp:1031` (it skips the legacy 30067/30068 mutating-method warning and gives E30050 instead) and `slang-lower-to-ir.cpp:13815` (no mutable temp). No test asserts E30011/E30047/E30050 on a modern param, so a change can break the rule silently. PR #13406 nearly did; Tess caught it in https://github.com/shader-slang/slang/pull/13406#discussion_r4342226984.

Other facts:
- Only 37 of 5,350 tests use `func`.
- E30621 (param needs a type) is tested only through accessors.
- E30620 (`let x;`) is untested. The generic-value-param tests check E30625; its message text looks similar, so a grep on the message is misleading.
- `func f(x = 1)` is a parse error (E20001), because `_peekModernStyleVarDecl` (parser.cpp:5103) does not treat `=` as a modern-param follower.
- Grep pitfall: `func` shows up in many `// CHECK:` lines, because diagnostics and hover print signatures in func form even for legacy declarations. Anchor any `func` regex to the start of a line.
