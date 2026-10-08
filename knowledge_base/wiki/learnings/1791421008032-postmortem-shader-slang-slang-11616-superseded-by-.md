---
title: "postmortem: shader-slang/slang#11616 superseded by PR #13175"
type: learning
topic: slang-compiler
source: learnings/1791421008032-postmortem-shader-slang-slang-11616-superseded-by-.md
---

# postmortem: shader-slang/slang#11616 superseded by PR #13175

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-08T00:56:48.032Z
---

# postmortem: shader-slang/slang#11616 superseded by PR #13175

**Issue:** shader-slang/slang#11616. A `[ForceInline]` return emitted `DebugNoScope`, so caller locals ended up with no debug scope.

**Ours:** draft PR #11617 (nv-slang-bot, opened 2026-06-15, +279/−29). It made `IRDebugScope` variable-arity (1 or 2 operands) and restored a one-operand caller `DebugScope` after the inlined region. In one shape it overloaded `DebugNoScope` to carry a restore-scope operand. It also stopped the backward inline-context scan at scope boundaries so that sibling calls were not mis-nested. The PR sat as a draft for months and was reassigned to pdeayton-nv on 08-04. pdeayton-nv closed it on 2026-10-07.

**Theirs (merged 2026-09-22):** PR #13175 by pdeayton-nv (maintainer), +388/−140. It takes the same core idea: restore the caller's active scope and inline chain explicitly, and allow a one-operand `DebugScope`. It is cleaner in three ways:
1. `DebugNoScope` becomes a **zero-operand** inst that is never emitted on inline return. It no longer has two meanings. Ours made `DebugNoScope` carry an optional restore operand, which gave one opcode two semantics, contrary to the "one canonical representation" rule.
2. It **reuses the specialized `DebugFunction` records**, so entry scopes, restored scopes and locals all refer to the same function.
3. It **bumps the supported IR module version range (31..31)** for the changed operand layout. Ours changed IR operand layout without bumping the module version, which breaks serialized modules.

It also updates the LLVM emit path, which ours didn't touch, and adds coverage for generic and separately compiled calls.

**Transferable rules:**
- When a fix changes an IR inst's operand layout or arity, bump the IR module version range in the same PR and test separately compiled modules.
- Don't widen an existing opcode's meaning to carry a new case (DebugNoScope + optional scope). Add or extend the inst that actually represents the concept (DebugScope), and keep the old one single-purpose.
- When changing a debug-info IR shape, audit every emitter (SPIR-V **and** LLVM), not just the target in the repro.
- A bot draft that a maintainer has been assigned for more than 4 weeks with no review is a signal the maintainer will write their own fix. Ask early whether they want the bot PR.

Related: the existing learning "post-13175 IR DebugNoScope has no producer" (stale-test guidance).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791421008032-postmortem-shader-slang-slang-11616-superseded-by-.md`_
