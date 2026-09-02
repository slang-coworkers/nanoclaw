---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788289544546-2tp88b
written_at: 2026-09-01T21:09:16.279Z
---

# Testing CUDA fp-mode-fast redirect: -target ptx approx-op FileCheck is confounded by NVRTC --use_fast_math

From R2/R3 review of shader-slang/slang#12872 (Honor -fp-mode fast for CUDA transcendentals). A codex critique-gate pass caught a subtle test-efficacy error I nearly signed off on.

**The trap:** To prove the prelude's `#if SLANG_CUDA_ENABLE_FAST_MATH` redirect actually *selects* `__cosf` (not just that the `#define` is emitted / the branch compiles), the intuitive test is a `-target ptx -fp-mode fast` lane that FileChecks for `sin.approx.f32`/`cos.approx.f32`/`lg2.approx.f32`. **This does NOT isolate the prelude redirect.** In Slang, `-target ptx` routes through `CodeGenTarget::CUDASource` and then compiles the emitted `.cu` with NVRTC — and for `FloatingPointMode::Fast`, Slang *also* passes NVRTC `--use_fast_math` (slang-nvrtc-compiler.cpp). `--use_fast_math` by itself rewrites ordinary `sinf`/`cosf`→`__sinf`/`__cosf`, so the `.approx` ops appear in the PTX **even if the prelude gate were deleted / stuck-precise**. The "fast lane expects approx present" check therefore stays green regardless of whether the prelude redirect works.

**What such lanes do / don't catch** (for a regression that deletes or inverts the prelude gate):
- Gate FLIPPED to `#ifndef` (fast when macro *absent*): CAUGHT by the *default* (no-`-fp-mode fast`) lane — no `--use_fast_math`, macro absent → wrapper emits `__sinf` → `.approx` present → the default lane's `-NOT: *.approx` fails. ✓
- Gate DELETED / always-precise: MISSED — fast lane green (masked by `--use_fast_math`), default lane also green. Slips through both.

**Robust test:** compile the offline nvcc fixture (cuda-prelude-vec1-make.cu) with the macro defined vs undefined and **without** `--use_fast_math`, then FileCheck the *preprocessed CUDA source* for `__cosf` vs `::cosf`, or check the PTX for approx-vs-precise instruction patterns. That pins behavior to the gate itself, not the NVRTC flag. (Note: you can't FileCheck slangc's `-target cuda` emitted source directly for `__cosf` — slang-test emits the prelude as an `#include` line, so wrapper bodies aren't in the textual output; you must compile/preprocess the prelude.)

**Meta:** Reviewer A's own "ptx double-applies fast-math" Question directly undercut A's own suggested ptx-approx test — the two findings were in tension and neither reviewer nor I connected them until the codex critique gate did. Lesson: when a review both (a) suggests a target-X behavioral test and (b) notes target-X applies an independent optimization flag, check whether (b) confounds (a). Also: run the codex critique BEFORE emitting a "[Resolution]"/verdict, not after — the gate exists precisely to catch this class of overstatement.
