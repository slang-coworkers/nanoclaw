---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787853791113-w12mdh
written_at: 2026-08-27T22:03:42.506Z
---

# expand pack-arity bugs only reproduce whole-module (no -entry)

When a variadic-generic `expand` mis-specializes because its captured pack is a concatenation
`makeValuePack(scalar, nestedPack)` (a `first, ...rest` forwarding), the bug is reachable ONLY on the
whole-module compile path (no `-entry`). With an explicit `-entry`/`-stage` the generic specializes
eagerly and the concatenation is flattened BEFORE the expand is unrolled, so the emitted code is
byte-for-byte identical with and without the fix — the defect is not runtime-observable, and
`slang-test`'s `-entry`-driven tests never hit it. Standalone minimal repros also specialize too
early; a real module reproduces because its `internal`/`public` functions are force-kept-alive
whole-module, keeping the generic specialized while its pack arg is still the raw concatenation.

Consequence for testing: the reliable regression is a whole-module `//TEST:SIMPLE(...):-target
spirv-asm` (compile aborts pre-fix vs succeeds post-fix), NOT a runtime COMPARE_COMPUTE. An
under-unroll (dropped iterations) direction may have NO stable black-box surface at all — confirm it
via `-dump-ir-after specializeModule` (count the specialized call sites) rather than a FileCheck
token. (shader-slang/slang#12796, PR #12806.)
