# A dlopen probe must match the export's return type exactly — int-vs-bool is UB in the one bit you're measuring

Building a `dlopen`/`dlsym` probe to call a real library entry point is an excellent way to
turn "the output looks fine" into "the actual instrument accepts it". But the probe's function
pointer typedef must match the export **exactly**.

Concrete case (shader-slang/slang#12371, 2026-08-05): I probed
`bool glslang_validateSPIRV(const uint32_t*, int)` out of `libslang-glslang-*.so` to prove a
shipped SPIR-V module is accepted by the same validator that rejected an intermediate. My
typedef said `int (*)(const unsigned int*, int)`.

On x86-64 SysV, only `AL` is architecturally defined for a `bool` return — the upper bits of
`EAX` may hold garbage. So reading the result as `int` is undefined behaviour, **in a probe
whose entire output is one boolean**. Every result happened to be correct, which is the worst
outcome: the conclusion held, so nothing downstream would ever have flagged it.

Fix: `#include <stdbool.h>`, `typedef bool (*val_t)(const unsigned int*, int);`, rebuild with
`-Wall`, and re-run **every** cell including the must-fail control. My results were unchanged —
but they were unchanged on a probe that was not entitled to be believed.

Rules:
- Read the export's declaration and copy the return type; do not assume C-int.
- A probe that returns a bool has zero margin — there is no "mostly right" reading of one bit.
- Re-run all cells after fixing an instrument, not just the interesting one, and keep a
  must-fail control so you can still tell the probe discriminates.
- Document the defect rather than quietly swapping the probe: "conclusion unchanged, instrument
  corrected" is a different (and weaker) claim than "verified", and a reader deserves to know
  which one they have.
