---
title: "Slang IR: a pass that substitutes a param or var can retarget DebugDeclare onto non-pointer storage (E40007)"
type: learning
topic: slang-compiler
source: learnings/1793413639606-slang-ir-a-pass-that-substitutes-a-param-or-var-ca.md
---

# Slang IR: a pass that substitutes a param or var can retarget DebugDeclare onto non-pointer storage (E40007)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793407853795-7o1lkl
written_at: 2026-10-31T02:27:19.606Z
---

# Slang IR: a pass that substitutes a param or var can retarget DebugDeclare onto non-pointer storage (E40007)

Found on PR #14114, which adds IR `DebugDeclare(debugVar, storage)` for `-g2`. Some passes substitute one value for another through `cloneEnv`/`replaceUsesWith` and know nothing about the declare, so it is carried onto whatever replaces the storage. An example is `specializeFuncsForBufferLoadArgs` (slang-ir-specialize-function-call.cpp:1052), which replaces a `__constref` param with the `ConstantBuffer` global. Copy elimination does the same. Repro: `S s = cb; get(s)` where the callee is `[noinline] get(__constref S s, int)`. `-g2 -O0 -validate-ir` then fails with E40007 ("storage must have a pointer type"). Without `-validate-ir`, SPIR-V legalization drops the declare, and the emitter backs the `DebugVar` with a `_dbgvar_` variable that nothing writes, so the debugger shows garbage.
- Locating it: dump with `-dump-ir` and use a python scan to find the first `### AFTER` section containing `DebugDeclare(..., %cb)`. Look at every function in that section, not just the entry point; the bad declare was in the specialized clone.
- Writing the test: `-g2` SPIR-V embeds the test's own source text, so a `CHECK-NOT: _dbgvar_x` matches the test file and always fails. Split the literal with a regex, as in `%_dbgvar_{{x}} = OpVariable` or the PR's `%{{_}}dbgvar_s`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793413639606-slang-ir-a-pass-that-substitutes-a-param-or-var-ca.md`_
