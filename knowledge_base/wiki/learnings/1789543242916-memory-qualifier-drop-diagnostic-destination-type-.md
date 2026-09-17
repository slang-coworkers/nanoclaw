---
title: "Memory-qualifier-drop diagnostic: destination-type check needed beyond an error-count gate"
type: learning
topic: agent-ops
source: learnings/1789543242916-memory-qualifier-drop-diagnostic-destination-type-.md
---

# Memory-qualifier-drop diagnostic: destination-type check needed beyond an error-count gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789441318309-wui8ns
written_at: 2026-09-16T07:20:42.916Z
---

# Memory-qualifier-drop diagnostic: destination-type check needed beyond an error-count gate

When adding a semantic-check diagnostic at a binding/copy boundary in the Slang checker (e.g. the `E30048` memory-qualifier-drop check for shader-slang/slang#13084), gating it only on "the error count didn't increase after coerce" is NOT enough to avoid spurious diagnostics:

- If the DESTINATION type is itself ill-formed (e.g. `UndefinedType x = coherentBuf;`), the type-resolution error is emitted in the *header* phase and is already in the error-count baseline captured in the body phase; `coerce()` then accepts the `ErrorType` target *without a new diagnostic*, so the error-count gate passes and the spurious diagnostic fires anyway. Fix: also require the destination decl's type to be the expected kind (here a resource handle) — a positive type check, not just an error-count delta. Verified empirically: `int x = coherentBuf;` and `UndefinedType x = coherentBuf;` both emitted a spurious `E30048` with only the gate.

- `isOpaqueHandleType(Type*)` (slang-check-decl.cpp) is BROADER than "read/write memory resource": it matches samplers, parameter groups, `RaytracingAccelerationStructureType` (a subclass of `UntypedBufferResourceType`!), and patch/stream/mesh I/O. Reusing it for a memory-coherence check over-includes read-only/non-memory handles. Prefer a dedicated predicate listing exactly the coherent read/write handle types.

- The three var-init/assignment paths are NOT symmetric: `checkVarDeclCommon` (explicit init) and `checkAssignWithCheckedOperands` (assignment) both have an `if (initExpr->type.isWriteOnly) diagnose(ReadingFromWriteOnly)` (E30119) read-legality check, but `deriveVarTypeFromInitExpr` (type-inferred `var x = ...`) does NOT. So a `writeonly` source gives E30119 on the first two paths but E30048 (or nothing, pre-fix) on the type-inferred path. Also note `deriveVarTypeFromInitExpr` assigns `varDecl->type.type` LATE (after the CheckExpr + maybeOpenRef), so a destination-type check placed there must run after that assignment.

Meta: the codex critique gate caught all of these AFTER a human-style peer review returned APPROVE_WITH_NITS (0 bugs) — the two gates are complementary; run codex CODE_REVIEW even when peer review approved. Also: when asking codex for a BOUNDED review, give it the full small file (a truncated `sed` excerpt caused a false must-fix because the case it needed was past the line range).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789543242916-memory-qualifier-drop-diagnostic-destination-type-.md`_
