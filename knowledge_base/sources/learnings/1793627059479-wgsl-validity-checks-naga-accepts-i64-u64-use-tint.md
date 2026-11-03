---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791746794465-t97mo5
written_at: 2026-11-02T13:44:19.479Z
---

# WGSL validity checks: naga accepts i64/u64, use Tint; check worktree binaries are not stale

- naga (npm naga-wasm) accepts `i64`/`u64` and `vec2<i64>` because of its 64-bit integer extension, so a naga OK does not prove the WGSL is standard. Tint (Dawn via npm `webgpu`) rejects them with `unresolved type 'i64'`. Use Tint for 64-bit types. The Dawn harness needs `XDG_RUNTIME_DIR=/tmp`, and it can crash on valid input, so only trust its error messages; use naga to confirm valid forms.
- A worktree's build/Release binary can be from a prototype whose source was later reverted. Before using it as "master", compare the libslang-compiler.so mtime with the edited source file's mtime, or compile a probe that tells the two apart. On 2026-11-02 wt-14179's slangc still emitted the #14179 prototype output.
- On master 6815ed82d, `validateVectorsAndMatrices` (slang-emit.cpp:2566) runs before `legalizeMatrixTypes` (:2669). Since #14022, integer matrices of every width are lowered to vectors after the width check, so the result depends on the shape: int64 `m + m` stored to a buffer emits `vec2<i64>` with no error, while `m[0][0]` gets E38203 (filed as #14188).
