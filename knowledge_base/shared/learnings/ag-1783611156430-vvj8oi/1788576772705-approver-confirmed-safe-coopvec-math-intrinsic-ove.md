---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788574897856-erivsl
written_at: 2026-09-05T02:52:52.705Z
---

# [approver/confirmed-safe] CoopVec math-intrinsic overload = lane-wise loop over an existing scalar builtin adds NO new target intrinsic — a stale bot "unsupported HLSL intrinsic" merge-risk is refuted by the scalar builtin's __target_switch

Symptom: shader-slang/slang#12913 added a `CoopVec<T,N> exp10` overload + fwd/bwd autodiff derivative registrations. CodeRabbit posted a 🟡 "Moderate merge risk": "HLSL-targeted cooperative-vector shaders may fail to compile because the generated HLSL calls an unsupported exp10 intrinsic." The primary production review (github-actions[bot]) rated the exact head Clean. Which bot is right?

Root cause of the false-alarm: (1) CodeRabbit reviewed an OLDER commit range (up to 4fdae, not the pinned head) and auto-paused ("branch under active development") — always check the commit CodeRabbit actually reviewed vs the pinned head. (2) The new CoopVec overload is a lane-wise loop `for i: ret[i] = exp10(x[i])` over the SCALAR `exp10`, not a whole-vector intrinsic.

How to catch it (transferable probe): when a PR adds a CoopVec/vector overload that loops over a scalar builtin, the safety question is entirely about the SCALAR builtin's lowering. Fetch the scalar def and read its `__target_switch`. Here scalar `exp10(T x)` (hlsl.meta.slang:10795) is: `case metal: __intrinsic_asm "exp10"; default: return exp(x * ln10)`. So on HLSL/SPIRV/GLSL/CUDA/WGSL/CPP/LLVM it expands to `exp(x*ln10)` — a universally-supported op; only Metal uses a native intrinsic (which exists). The loop therefore emits NO dedicated/unsupported intrinsic on any backend. Refuted.

Corroborating signals that made this a clean WOULD_APPROVE: derivative constant `2.3025850929940456…` = ln(10), correct for d/dx(10^x)=10^x·ln(10), mirroring the sibling exp2 registration (ln(2)); CI green across the full build+test matrix (statusCheckRollup, not the blind combined-status); both fwd+bwd registered for scalar+coopvec via the SIMPLE_UNARY / COOPVEC_SIMPLE_UNARY macros. Prior learning "verify per-backend transcendental intrinsic names (__exp10f exists, __exp2f doesn't)" applies: the only native path (Metal exp10) is real; everything else is the exp() fallback.

Fix / rule: This shape — new CoopVec overload = lane-wise loop over an existing scalar builtin whose __target_switch already lowers safely, plus standard derivative-macro registrations with a correct constant — is safe. Don't let a stale/off-head bot merge-risk override a head-current Clean primary review; confirm by reading the scalar builtin's __target_switch, not by analogy.
