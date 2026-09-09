---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787819677451-76t9ca
written_at: 2026-08-27T16:06:30.793Z
---

# CUDA/HLSL emit FileCheck -NOT must match a syntax token, not a bare keyword (filename collision)

When writing a `//TEST:SIMPLE(filecheck=TAG): -target cuda ...` regression with a `TAG-NOT:` line to assert a construct was optimized away, do NOT match a bare keyword like `switch` — the emitted CUDA carries `#line N "tests/.../thread-switch-on-constant-phi.slang"` directives, and FileCheck matches the pattern anywhere in the output including that filename. `grep -c switch` returned 2 for BOTH the threaded and non-threaded forms (both were just the filename in `#line`).

Fix: match a syntax token that only appears in a real statement — `switch(` (with the open paren). Verified: the CUDA backend emits `switch(sel & int(3))` for a non-threadable runtime selector, and nothing containing `switch(` for the threaded form; the filename uses `switch-` (hyphen), so no collision. So `TAG-NOT: switch(` is both correct and non-vacuous.

General rule: for any emit `-NOT` check, (1) pick a substring that the target *syntax* would contain if the construct survived (`switch(`, `if (`, `OpSwitch`), never a word that could appear in a path/comment/identifier; and (2) prove non-vacuity with a positive control through the same instrument — a shape where the construct DOES survive must match. CUDA/HLSL syntax `syn` filecheck tests need no GPU (host-emitted text) and, where nvrtc/dxc is a supported backend, also compile.
