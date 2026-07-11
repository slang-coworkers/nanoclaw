---
name: project_12042_half_double_rounding_parked
description: "#12042 half double-rounding on CPU/C++ target — triaged→PARK needs-maintainer (design-gated); split from #11996"
metadata: 
  node_type: memory
  type: project
  originSessionId: feccc4a7-f696-460d-bed0-c98258e09a8d
---

shader-slang/slang#12042 — `half` rounding on CPU/C++ target incurs double rounding (loses ties-to-even). nv-slang-bot tracking issue, **split out of [[project_11996_half_to_int_cpu_conv]]** (which is only the narrow half→int operator-compile fix and is NOT blocked by this). Correctness concern raised by @skiminki-nv.

**Disposition (slang-triager, HEAD b721cb68e):** bug/correctness, **P3/low**, component = frontend literal + CPU/C++ prelude `struct half`. **TRIAGE → PARK as needs-maintainer** — design-gated. NO auto-dispatch (bot-authored tracking issue + maintainer design call). NOT `reproduced` (static confirmation only, no build). Type already Bug.

**Open maintainer design call:** (A) delegate to stdlib `std::float16_t`/`_Float16` when available (may pick up native HW fp16); (B) header-only IEEE-754 correctly-rounded fp16 emulation lib when not; or both gated on availability. Risk with A alone: cross-build-host non-determinism (a `half` literal could round differently by build machine) — unacceptable unless emulation fallback is bit-identical.

**Triager's refinements to the issue's claims (ANALYSIS, not runtime-verified):**
- Load-bearing fix = **conversions + literals**, NOT basic arithmetic. Pure half +−×÷ via `float` is provably clean for NORMALIZED results (Figueroa benign-double-rounding: float's 24 sig-bits == 2q+2 bound for q=11). Residual exposure only in subnormal/overflow region.
- Front-end literal path is **via double(53-bit), not float** as the issue states (`slang-lexer.cpp:1335-1354` `_truncateDouble`) — closer to correct than the issue implies; truly-correct decimal→half needs a half-aware parser (fast_float has no half mode) = the design-gated part.
- Runtime `struct half` (`prelude/slang-cpp-scalar-intrinsics.h:670-713`) has only `explicit half(float)`, so double→half goes double→float(round1)→f32tof16(round2). A **native-fp16 fast path already exists** at :663-666 gated on `__STDCPP_FLOAT16_T__`/`FLT16_MIN`.
- Shippable interim fixes independent of the A/B call (if maintainer wants): (i) add direct `double`→half ctor to `struct half`; (ii) `slang-ir.cpp:2465` round double→half directly instead of `HalfToFloat(FloatToHalf((float)inValue))`. Basic arithmetic needs no change.

**Dedup:** unique. #11996 is the intentional-split parent (not a dup). My initial dedup pointer to #11990 was **misdirected** (that's IArray 64-bit indexing, not fp16). #11985 = Metal CI flake, unrelated. #11837/#10531/#6608 etc. = different fp16 concerns.

**GitHub footprint:** verdict POSTED by triager — issue #12042 [comment 4934104299](https://github.com/shader-slang/slang/issues/12042#issuecomment-4934104299). Chain closed at triaged/parked; triager will re-open on a substantive human comment.

**Next:** re-engage on maintainer comment/PR. Do NOT auto-dispatch a fixer. triager owns GitHub verdict (closest-to-state); Main does not post here.
Memo: `/workspace/inbox/a2a-1783677013009-x3o1xo/triage-12042.md` (triager fs).
