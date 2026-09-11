---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789046055257-b8rrbh
written_at: 2026-09-10T15:10:13.255Z
---

# Slang nested [raypayload] member PAQ inheritance — 3-layer fix + gotchas (slang#12991)

Fixing shader-slang/slang#12991 (a `[raypayload]` struct member whose type is itself a `[raypayload]` struct, wrongly rejected as unqualified). Key takeaways, confirmed by build + codex critique:

**The fix is inherently multi-layer.** A "relax a frontend validation" fix for PAQs must be threaded through every downstream layer that re-asserts the same invariant:
1. Frontend `checkRayPayloadStructFields` (`slang-check-modifier.cpp`): exempt a payload-struct-typed member from the read/write requirement. Use `isDeclRefTypeOf<StructDecl>(type).getDecl()` + `findModifier<RayPayloadAttribute>()`.
2. IR-legalize `addDefaultPayloadAccessQualifiersToStruct` (`slang-ir-hlsl-legalize.cpp`): skip a field whose `getFieldType()` is an `IRStructType` with `IRRayPayloadDecoration`. WITHOUT this, a frontend-only fix still emits `Nested nested : read(...) : write(...)` which DXC rejects.
3. Emit needs NO change — with 1+2 the field key carries no read/write decoration. A defensive emit guard would be dead code (repo rejects guards never hit under valid input).

**Fold in the "explicit qualifier is an error" case (Approach C).** An explicit `read`/`write` on a payload-struct-typed member is forbidden (DXC rejects it). Diagnose it in the frontend rather than silently emitting invalid HLSL. Every reviewer flags this if you skip it. Report only that one error (not also E40001 invalid-stage) — the whole qualifier is disallowed.

**Gotchas:**
- Diagnostic codes in `slang-diagnostics.lua` are NOT sectioned by category — a "Ray tracing (40000-40001)" comment does not mean 40002 is free (it was `cyclic-reference`). Grep used codes and pick a free one; a duplicate fails the build at the FIDDLE step with `Diagnostic validation failed: ... duplicate code`.
- `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` uses caret-aligned annotations: `//CHECK:` + spaces so the `^^^` align to the *source column* of the token on the preceding line (spaces = col-9, since `//CHECK:` is 8 chars), with caret count = token length. NOT free-form FileCheck substrings.
- A fresh `git worktree` may have uninitialized submodules → `git submodule update --init --recursive` before the first cmake configure (else `get_target_property() ... non-existent target SPIRV-Headers`).
- The critique-gate hook re-arms after each delivery: creating the PR consumes the OUTPUT_REVIEW approve, so a follow-up handoff (peer-review dispatch) needs another fresh OUTPUT_REVIEW round even when nothing changed. And chain delivery markers (`[Fix Review Request]`) require `in_reply_to` set on the send_message call.
