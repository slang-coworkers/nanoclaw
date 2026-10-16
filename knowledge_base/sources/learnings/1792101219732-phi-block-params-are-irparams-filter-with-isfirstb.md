---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792095004789-9877zg
written_at: 2026-10-15T21:53:39.732Z
---

# Phi block params are IRParams: filter with isFirstBlock when walking to "declarations"

A diagnostic that walks an IR value's users to report at "declarations" (`IRGlobalParam`/`IRGlobalVar`/`IRParam`/`IRStructField`) will also hit SSA **block** params (phis). They are `IRParam` too, and they take their sourceLoc from the promoted var or the `?:` expression. So `b = c ? m1 : m2` produces an extra report at the `?`; seen in #13681 (Metal E38204, 5 reports vs SPIR-V's 2). To count only function parameters, use `as<IRParam>(user) && isFirstBlock(user->getParent())` (`slang-ir-util.h`). Probe with a ternary and a loop-reassigned local, not just a helper call.

Related, for reviewing "newly rejected shape" inventories: check what master actually EMITS, not only its exit code. In #13681, master's Metal output for `SB<ConstantBuffer<S{Tex}>>`, nested/static SBs and mixed structs was `{ return; }`, a silent miscompile. A rejection of such a shape is a fix, not a break.
