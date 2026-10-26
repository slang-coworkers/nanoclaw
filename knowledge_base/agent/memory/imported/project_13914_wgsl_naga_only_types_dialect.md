---
type: project
name: project_13914_wgsl_naga_only_types_dialect
description: "HUMAN-OWNED, nothing dispatched (10-25 07:4xZ). slang#13914 (albertrodriguezclo, external): on WGSL, uint64_t/int64_t emit u64/i64, Atomic<uint64_t> emits atomic<u64>, Atomic<float> emits atomic<f32> — naga-only spellings that Tint rejects at pipeline creation, with no slangc diagnostic. Reproduced on master 52e29ab43b. Explicit design question to maintainers: a WGSL dialect switch (capability atom wgsl_naga_native vs -wgsl-dialect naga option), standard WGSL errors at the call site otherwise. No author PR names it; no chain of ours depends on it."
---

# slang#13914: WGSL emits naga-only types without a diagnostic

**10-25 07:44:16Z `issue_opened`.** Main webhook session `sess-1792914258870-qp31v7` (thread
`gh-issue-shader-slang/slang-13914`, the only session on it). Live read at ~07:46Z: open, 0 comments, no
labels, no assignees, empty timeline, body unchanged.

**Claim checked on master `52e29ab43b`** (local Release build, the issue's repro): `slangc -target wgsl`
succeeds and emits `array<atomic<f32>>`, `atomicAdd(&f_0[0], 1.0f)` and `u64(id_0.x) * u64(4294967297)`.
The report is accurate. Tint rejection is the author's result (not run here).

**Context.** #11164 (closed 2026-05-20, jkwak-work) is the change that made the emitter spell `UInt64Type` as
`u64`, so the current naga-friendly output was a deliberate maintainer choice. That makes the dialect split a
design call for maintainers, not a bot fix.

**Ownership.** Same external author as #13906/#13910 and PRs #13903/#13905/#13907/#13908/#13911/#13912/#13918
(10-25 morning). #13918 (strong `compareExchange`) opened 10 s later but references #13917, not #13914. The issue
says the `Atomic<float>` CAS-loop lowering is "prototyped separately".

**Disposition: held, nothing dispatched or posted.** Same pattern as
[project_13910_wave_intrinsics_side_effect_free_dce](project_13910_wave_intrinsics_side_effect_free_dce.md):
human-filed, ends with a question to maintainers; R6 (#13596) has the bot wait on human issues.

**Resume on:** an `@nv-slang-bot` mention on #13914, an author PR that names it, or an operator ask. No timer:
nothing of ours waits on this.
