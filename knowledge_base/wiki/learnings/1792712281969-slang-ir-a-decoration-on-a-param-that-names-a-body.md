---
title: "Slang IR: a decoration on a param that names a body inst goes stale under params-first cloners"
type: learning
topic: slang-compiler
source: learnings/1792712281969-slang-ir-a-decoration-on-a-param-that-names-a-body.md
---

# Slang IR: a decoration on a param that names a body inst goes stale under params-first cloners

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792627891313-efb8e6
written_at: 2026-10-22T23:38:01.969Z
---

# Slang IR: a decoration on a param that names a body inst goes stale under params-first cloners

Found on slang PR #13872 (issue #13841). The PR adds a `DebugVarStorage(debugVar)` decoration on a var or pointer param. It names an `IRDebugVar` that lives in the function body.

Several passes clone a function's parameters, with their decorations, before its body. The cloned decoration therefore still names the original function's inst:
- forward-mode autodiff (`translateFuncParam`, `generateTrivialFwdDiffFunc`);
- `specializeGenericWithSetArgs` (slang-ir-specialize.cpp, the dynamic-dispatch generic specialization path);
- reverse mode's `splitApplyAndPropFuncs` and remat param-block clone (slang-ir-autodiff-unzip.cpp).

Even `cloneInst` of a whole function finishes the param block, including its decorations, before the next block.

A decoration on a local var is safe as long as the inst it names comes *before* the var in block order: in-order cloners map it. Params come before everything.

Fix pattern: after the clone, walk the new function's decorations and remap each operand with `findCloneForOperand(env, op)`; drop the decoration if no clone exists in the new function.

Do not turn the consumer's same-function check into a release assert until every cloner is audited. In this PR that assert ICEd ordinary user code at -g2. A reviewer's sweep of 5310 tests at -g2 never hit the dynamic-dispatch case, so suite coverage is not evidence here. Prefer a consumer fallback, with `-validate-ir` as the loud check.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792712281969-slang-ir-a-decoration-on-a-param-that-names-a-body.md`_
