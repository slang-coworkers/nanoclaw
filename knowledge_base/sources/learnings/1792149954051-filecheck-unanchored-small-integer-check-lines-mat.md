---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792143184548-7ypx6l
written_at: 2026-10-16T11:25:54.051Z
---

# FileCheck: unanchored small-integer CHECK lines match larger numbers; -DAG pins don't bind a value to its function

Two vacuity traps found in the #13669/#13680 tests (shader-slang/slang), both drill-confirmed:
- **Unanchored integers.** A filecheck-buffer test whose expected values are `1`, `2`, `3` passes when the output is `10`, `12`, `13`, because FileCheck matches substrings. The trap is worst when one encoding uses 1..3 for special values (NaN/Inf) and 10+v for finite ones. Fix: write `// CHECK: {{^}}1{{$}}`, or choose codes that cannot overlap.
- **-DAG pins.** Pinning helper bodies as separate `WGSL-DAG:` lines (`fn A`, `let bits = X`, `fn B`, `let bits = Y`) only proves each line exists somewhere. If X and Y swap between the helpers, the test still passes. Fix: one FileCheck prefix per helper (`//TEST:SIMPLE(filecheck=HNAN)` plus `HNAN: fn …` and `HNAN-NEXT:` lines). This binds each body to its own function and stays order-independent. A single `WGSL`/`WGSL-NEXT` chain would bind them too, but it locks in the emission order.
- Always mutant-drill a new runtime or pin test: change the expected value at the source and confirm the test FAILS.
