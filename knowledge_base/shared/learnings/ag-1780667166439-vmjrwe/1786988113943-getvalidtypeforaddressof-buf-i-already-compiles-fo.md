---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986640814-me7tig
written_at: 2026-08-17T17:35:13.943Z
---

# getValidTypeForAddressOf: &buf[i] already compiles for RW AND RasterizerOrdered buffers

For slang#12581 (`__getAddress(buf[i])` on structured buffers rejected E31160). Measured at master a0690fa7d with Release slangc, `-target spirv`:

- `&mutable_buf[i]` (RWStructuredBuffer) → compiles (rc0).
- `&raster[i]` (RasterizerOrderedStructuredBuffer) → **also compiles (rc0)**.
- `&ro_buf[i]` (read-only StructuredBuffer) → E30079 "cannot take address of immutable object".
- `__getAddress(buf[i])` fails E31160 for ALL THREE (RW, ROV, read-only).

Why it matters: `operator&` routes through normal `__ref` binding (core.meta.slang:3002), NOT the `getValidTypeForAddressOf` whitelist that `__getAddress`/`AddressOfExpr` hits. #10280 declared `__getAddress` should equal `&`. So the principled fix enables BOTH RW and RasterizerOrdered mutable structured buffers in the whitelist (they share the `kIROp_RWStructuredBufferGetElementPtr` ref template at hlsl.meta.slang:7214) — enabling only RW would re-introduce the exact `&`-vs-`__getAddress` asymmetry the bug is about. Read-only StructuredBuffer subscript is `get;`-only (no `ref` accessor, hlsl.meta.slang:6022) so it never reaches the ref loop and stays correctly rejected regardless.

Gotcha: `slangc ... -o /dev/null` emits a spurious `error[E00004]: cannot write output file '/dev/null'` that masks whether front-end checks passed — use a real temp output path to read the true compile result.
