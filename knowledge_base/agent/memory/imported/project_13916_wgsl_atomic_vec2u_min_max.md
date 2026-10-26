---
type: project
name: project_13916_wgsl_atomic_vec2u_min_max
description: "WAITING ON MAINTAINER 10-25 07:54Z. Triaged feature-request/medium/P2, parked for a scope decision; no fixer. Timer: triager one-shot t-291bac (10-28 08:00Z). slang#13916 (albertrodriguezclo, external): WGSL atomic_vec2u_min_max (atomicStoreMin/Max on atomic<vec2<u32>>) is not expressible; Atomic<uint64_t> emits atomic<u64> (Tint rejects), Atomic<uint2> fails E38029. Options A: Atomic<uint2> + no-return min/max (maybe reuse reduceMin/reduceMax), B: lower Atomic<uint64_t> on WGSL (needs u64 emulation), C: diagnostic only (#13914). Triager on gh-issue-shader-slang/slang-13916."
---

# slang#13916: WGSL 64-bit atomic min/max through `atomic_vec2u_min_max`

**10-25 07:44Z `issue_opened`.** Main webhook session `sess-1792914261795-1zxkgo` checked live state (open, 0
comments, never edited, CONTRIBUTOR, unassigned) and sent it to slang-triager on
`gh-issue-shader-slang/slang-13916`. The issue ends with a scope question to the maintainers ("Would you take that?").

**10-25 07:54Z [Triage]** (memo archived at `/workspace/agent/reports/triage/triage-13916.md`):
feature-request / medium / target-emit (WGSL) + core-module `Atomic<T>` / P2.
- The triager reproduced it on master 52e29ab43. The reporter's shader emits `array<atomic<u64>>` +
  `atomicMax(..., u64(...))` with no `enable` directive. Tint (Dawn null backend) rejects `u64`.
  `Atomic<uint2>` fails E38029 (not `IAtomicable`).
- Tint allows **only** `atomicStoreMin`/`atomicStoreMax` on `atomic<vec2<u32>>`, and only in storage buffers.
  Load, store, exchange and max are all rejected.
- Options: A. `Atomic<uint2>` with no-return min/max plus the `enable atomic_vec2u_min_max` directive. The
  existing `reduceMin`/`reduceMax` could be reused, and the other ops would need a WGSL diagnostic. B. lower
  `Atomic<uint64_t>` (needs u64→vec2 emulation; large). C. a diagnostic only (#13914 scope). The triager
  recommends A, tentatively; the maintainers own the choice.
- GitHub (Main checked live): triage comment 6395090912 (nv-slang-bot, 07:52:59Z); label `reproduced`;
  type Feature.
- R6 (#13596): this is a bot post 9 min after a human filed the issue. That follows current routing, because
  gate PR slang-coworkers/nanoclaw#1993 is still a draft (same as #13858), so the bot does not apply the
  4-day wait by hand. Expect compliance-check to score it as an R6 FAIL.
- **Held:** no fixer. **Resume on:** a maintainer direction, an @nv-slang-bot mention, a reporter PR, or t-291bac.

Siblings from the same author on 10-25: [#13914](project_13914_wgsl_naga_only_types_dialect.md),
[#13915](project_13915_wgsl_byte_address_interlocked.md),
[#13917](project_13917_wgsl_compare_exchange_weak.md),
[#13906](project_13906_wgsl_comparison_sampling_non_depth_texture.md),
[#13913](project_13913_wgsl_calculate_level_of_detail.md).
