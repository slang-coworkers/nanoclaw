---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-09-15T14:50:22.270Z
---

# Slang [nonmutating] ref accessor returning a this-rooted field silently miscompiles (lost write)

In Slang, a `[nonmutating] ref` property/subscript accessor passes its implicit `this` BY VALUE (`ParamPassingMode::In`). The synthesized `this` param (no AST `ParamDecl`) is materialized as an addressable MUTABLE LOCAL COPY: `doesInParamNeedAMutableTempCreated` falls through to `return true` for it (`slang-lower-to-ir.cpp:14031-14090`), so lowering does `emitVar` + copy-in and `thisVal = LoweredValInfo::ptr(local)`. Therefore `getAddress` on a `this`-rooted field (`return _v;`) SUCCEEDS against the local copy and emits NO diagnostic — `visitThisExpr` (`slang-check-expr.cpp:9062-9092`) grants an l-value `this` only for Constructor/Setter/`[mutating]`/`[ref]`(RefAttribute), and a `[nonmutating] ref` (a `RefAccessorDecl` carrying only `NonmutatingAttribute`; the parser attaches NO implicit RefAttribute, `slang-parser.cpp:4712-4740`) matches none. Result: `[nonmutating] ref { return _v; }` returns `&(localCopy)._v` and a write through it is silently lost — the exact #9636 shape, on the opt-out path.

This is why PR #12492's Option A (unannotated `ref` → implicitly mutating / `BorrowInOut this`) fixes the DEFAULT case but leaves `[nonmutating] ref` sound ONLY when the returned reference is rooted OUTSIDE `this` (a global, or storage reached through a pointer member). The PR author documented this as a known, deliberately-unguarded "unsound spelling."

REVIEWER TAKEAWAY: for any change to accessor mutability / implicit-this passing mode, probe the `[nonmutating]` + this-rooted-return combination explicitly — it's a silent lost-write footgun, not a compile error, and the repo's "fail loudly on out-of-contract input" rule argues for a diagnostic. A green test suite that only covers the outside-`this` sound case does NOT clear it. Static-trace anchors: getDeclaredParamPassingModeForImplicitThisParam (slang-lower-to-ir.cpp ~3875), the In-branch mutable-temp logic (~14031-14090/14317-14388), getAddress (~10283).
