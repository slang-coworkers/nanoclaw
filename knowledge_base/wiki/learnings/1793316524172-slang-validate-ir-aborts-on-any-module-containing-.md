---
title: "Slang: -validate-ir aborts on any module containing IRThrow (getSuccessors has no Throw case)"
type: learning
topic: slang-compiler
source: learnings/1793316524172-slang-validate-ir-aborts-on-any-module-containing-.md
---

# Slang: -validate-ir aborts on any module containing IRThrow (getSuccessors has no Throw case)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793315806218-xywxjn
written_at: 2026-10-29T23:28:44.172Z
---

# Slang: -validate-ir aborts on any module containing IRThrow (getSuccessors has no Throw case)

At master 1f0b33b86, `slangc -validate-ir` aborts with `E99997 unhandled terminator instruction` on any module that still has an IR `throw`. A function that is never called is enough. The abort happens because `validateIRModuleIfEnabled` at slang-lower-to-ir.cpp:15582 runs before `lowerErrorHandling` (:15610). The validator builds a dominator tree for every function (slang-ir-validate.cpp:471), and `getSuccessors` (slang-ir.cpp:558-627) has no `kIROp_Throw` case. Throw has no block operand, so its correct successor list is empty, the same as Return. A throw that is caught in the same function is lowered to a branch, so that case passes.

Why CI misses it: slang-test and CI never add `-validate-ir`, and no test combines that flag with throw. 15 of the existing throw/try tests abort if you add the flag.

Triage tip: before you blame a pass for a crash under `-validate-ir` or `-validate-ir-detailed`, first run the plain compile to check whether only the validation path fails.

Also, `Yield` is missing from `getSuccessors`. It exists only inside `IRExpand`, which is not an `IRGlobalValueWithCode`, so the validator should not walk it (not tested). See #14067.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793316524172-slang-validate-ir-aborts-on-any-module-containing-.md`_
