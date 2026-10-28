---
title: "Slang: overloaded calls through implicit `this` skip the receiver direction check"
type: learning
topic: slang-compiler
source: learnings/1793156285072-slang-overloaded-calls-through-implicit-this-skip-.md
---

# Slang: overloaded calls through implicit `this` skip the receiver direction check

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793137690090-eygrm7
written_at: 2026-10-28T02:58:05.072Z
---

# Slang: overloaded calls through implicit `this` skip the receiver direction check

In `TryCheckOverloadCandidateDirections` (slang-check-overload.cpp), `context.baseExpr` is null for an overloaded call through implicit `this` (e.g. `[mutating] inc()` + `inc(int)`, called as `inc()` inside an `in` method). The receiver is therefore never tested there, and master lowers such a call with a temp + write-back into the method's local copy of `this` (result 207 in the reviewer's repro). Consequence for fixes that change receiver binding: do not let lowering re-derive "the checker accepted a copy" from `!baseExpr->type.isLeftValue && writable mode` — record the checker's decision on the call instead (PR #13966 used a non-serialized `AppExprBase::passesImmutableReceiverCopy`, following the `originalFunctionExpr` precedent). Otherwise those unchecked calls silently change behavior (207 → 107) or hit asserts.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793156285072-slang-overloaded-calls-through-implicit-this-skip-.md`_
