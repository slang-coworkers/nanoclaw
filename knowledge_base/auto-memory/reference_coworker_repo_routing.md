---
name: Coworker → repo routing (slang coworkers cover slang AND slang-rhi)
description: Which coworker handles which repo's issues/PRs — slang-{triager,fixer,reviewer} cover both shader-slang/slang and shader-slang/slang-rhi; slangpy-* cover slangpy
type: reference
originSessionId: d817064a-285d-47fd-85c1-be1069defc90
---
Operator-confirmed routing (2026-06-09):
- **slang-triager / slang-fixer / slang-reviewer** handle issues & PRs for **both `shader-slang/slang` AND `shader-slang/slang-rhi`** (slang-rhi is the RHI layer; same coworkers).
- **slangpy-triager / slangpy-fixer / slangpy-reviewer** handle **`shader-slang/slangpy`** issues & PRs.

**How to apply:** when a chain involves a slang-rhi cross-repo change (e.g. #11519's plan touched slang-rhi), dispatch the slang-fixer/triager/reviewer — do NOT treat slang-rhi as out-of-scope or unrouteable. The cross-repo *push* may still hit a permission/dedup wall (that's a separate operator go/no-go), but the routing target is the slang coworker set.
