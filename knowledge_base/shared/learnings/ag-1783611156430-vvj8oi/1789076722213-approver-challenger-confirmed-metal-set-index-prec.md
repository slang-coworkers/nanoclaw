---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789075456497-ogdu3b
written_at: 2026-09-10T21:45:22.213Z
---

# [approver/challenger-confirmed] Metal set_index precedence fix — confirming the test carries bits and there is no untouched-test regression

## Context
shader-slang/slang#12886 (Metal `kIROp_MetalSetIndices` emit): fixed a compound-index precedence bug (`tris[pbase + 1u]` emitted `pbase + 1U*3` = `pbase + 3` instead of `(pbase + 1U)*3`) and a point-topology null-deref (unconditional `as<IRVectorType>` on a scalar `uint` index). Decision: WOULD_APPROVE; human maintainer (jkwak-work) independently APPROVED at the same head. Confirmed-safe match.

## Transferable lesson (sharpens Step-0 recall for any Metal-emit precedence PR)
This is the concrete instance of the standing "could this observation have come out otherwise?" probe for a Metal emit fix. Two checks decide it, and both are cheap:

1. **Does the regression FileCheck reject the buggy emit?** For a precedence/parenthesization fix, the discriminating bit is a *literal structural* requirement the buggy output cannot satisfy — here the double open-paren `set_index((pbase{{.*}} + 1U)*3`. The buggy `set_index(pbase + 1U*3` has only the one call paren, so the `((` substring is absent → CHECK fails on buggy. If the CHECK is a bare wildcard (`{{.*}}`) it carries zero bits → OPEN_GAP. (Point-topology no-subscript is locked the same way: `,{{[a-z_0-9]+}});` forces a bare identifier directly followed by `)`, rejecting a `[0]` subscript.)

2. **Fold/hoist trap:** the compound index only survives to emitted MSL as an inline expression if it is (a) NOT constant (drive it from `SV_GroupIndex`, not a literal) and (b) used exactly once (so it is not hoisted to a temp). A test that folds or hoists the index tests nothing. Verify the test author did this before crediting the CHECK.

3. **No untouched-test regression (the ci_green-blind-to-check-runs false-safe):** a fix routed through the shared precedence machinery (`leftSide(General, Mul)` / `leftSide(General, Postfix)`) only ADDS parens where the operand's precedence is looser than the context — so for the common bare-identifier index (`tig*3+0`) the output is BYTE-IDENTICAL to before. Confirm by grepping existing tests for the touched emit token (`set_index`) — here only `tests/metal/simple-mesh.slang:69-71`, whose index is a bare identifier (identical) and whose value is an add already parenthesized by both old hand-written parens and the new Postfix path. A *targeted* (only-the-buggy-case-changes) token-shape change is NOT the unconditional-change class that broke untouched Metal COUNT tests in #12130.

## Layer check
Mesh index writes are Metal-only (lowered via `LegalizeMetalEntryPointContext` virtual dispatch; HLSL/GLSL/SPIR-V go through the shared `IRMeshOutputSet` with no index arithmetic), so a Metal-only emit fix sits at the correct layer — do not demand cross-backend changes.
