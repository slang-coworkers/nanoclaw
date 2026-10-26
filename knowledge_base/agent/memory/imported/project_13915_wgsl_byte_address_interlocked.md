---
type: project
name: project_13915_wgsl_byte_address_interlocked
description: "WAITING ON MAINTAINER 10-25 07:53Z. Triaged feature-request/medium/P2, parked for direction (jkwak-work/csyonghe); no fixer; reporter offered to prototype. Timer: triager one-shot t-1af259 (11-01 08:00Z). slang#13915 (albertrodriguezclo, external): WGSL RWByteAddressBuffer.Interlocked* all fail E36107 because WGSL atomics are typed (BAB emits array<u32>). Design question to maintainers: (1) whole buffer array<atomic<u32>> when any atomic touches it, (2) opt-in per buffer, (3) keep E36107 with a better message pointing at RWStructuredBuffer<Atomic<uint>>. Same root as #13661 atomic view. Triager on gh-issue-shader-slang/slang-13915."
---

# slang#13915: WGSL byte-address Interlocked* lowering

**10-25 07:44Z `issue_opened`.** Main webhook session `sess-1792914259976-5a0biu` sent it to slang-triager on
`gh-issue-shader-slang/slang-13915`.

- Reporter is the same external author as #13805, #13859, #13661; they open their own PRs, and here offer to
  prototype option 1/2 and measure D3D12 cost. A design decision belongs to a maintainer, not the bot.
- Related: #13661 (WGSL `Store<half>` atomic view, triager owns, assigned jkwak-work).

See [project_13805](project_13805_wgsl_byte_address_aligned_array_load_store.md),
[project_13859](project_13859_metal_subword_byte_address_load_store.md).

**10-25 07:53Z [Triage] (triager msg 12; memo /workspace/inbox/a2a-1792914839013-98qjcy/triage-13915.md):**
feature-request (design question) / medium / P2. WGSL emit + BAB legalize + capabilities. Atomics half of #13661.
- Reproduced on master 52e29ab43: only the `[require]` gate blocks (hlsl.meta.slang:7517-7599). With
  `-ignore-capabilities`, Slang emits `atomicAdd(&pool[off/4])`, which is invalid only because the buffer is `array<u32>`.
- WGSL limits: atomic<T> takes u32/i32 only (AddF32/F16/64-bit can never lower); an aliased view is forbidden; a strong CAS
  needs a loop (#13917 / PR #13918). The triager's internal view: (3) is needed whatever is chosen; 1 vs 2 reopens
  csyonghe's 2024 Atomic<T> decision. The public comment picks no option.
- GitHub (I checked live): triage cmt 6395090523 (nv-slang-bot, 07:52:56Z), label `reproduced`; the triager reports Type=Feature.
- **Held:** no fixer. **Resume on:** a maintainer direction, an @nv-slang-bot mention, a reporter PR, or t-1af259.
- Siblings filed in the same minute, #13917 (weak CAS, reporter PR #13918) and #13914 (atomic<f32>/u64), have their own
  Main webhook sessions (`0l10dh`, `qp31v7`).
