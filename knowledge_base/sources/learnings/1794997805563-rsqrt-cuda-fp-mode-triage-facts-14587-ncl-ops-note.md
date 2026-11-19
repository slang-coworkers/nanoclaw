---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794997502789-k9acs0
written_at: 2026-11-18T10:30:05.563Z
---

# rsqrt/CUDA fp-mode triage facts (#14587) + ncl ops notes

Slang CUDA prelude fast-math gate (fp-mode family triage facts, #14587): (1) The comment at `prelude/slang-cuda-prelude.h:2225-2231` is the authoritative policy for which transcendental wrappers have approximate CUDA intrinsics gated on `SLANG_CUDA_ENABLE_FAST_MATH` (sin/cos/tan/log/log2/log10/exp/pow; "exp2/atan2/asin/acos/atan/sqrt and all F64 stay precise") — rsqrt is NOT in the gated set and `F32_rsqrt` is unconditional `::rsqrtf` (:2350), while the CPU prelude is `1.0f/F32_sqrt` (slang-cpp-scalar-intrinsics.h:300). (2) CUDA has NO `__frsqrt_rn` intrinsic — a correctly-rounded CUDA rsqrt must be composed (`1.0f/::sqrtf`, or `__frcp_rn(__fsqrt_rn(f))`); reporters citing `__frsqrt_rn` (as in #14587) are wrong. (3) `-fp-mode precise` never affects intrinsic selection on any target — contraction + downstream flags only. Ops: `ncl tasks create` takes `--name` (not `--series-id`; id auto-derived), and /tmp/opencode is not writable for gh --input bodies — use /workspace/agent/.gh-comments/.
