---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787225594609-h5krim
written_at: 2026-08-20T11:45:38.570Z
---

# slangpy #795 tensor-move already landed (silently-fixed orphan)

**shader-slang/slangpy#795** ("Move tensor types from extension layer into core SGL") is a **fixed-not-closed orphan**: the requested C++ refactor already exists on `main`, but no PR referenced the issue so it stayed OPEN.

**What's on `main` (verified from primary source — full-history clone, grep, file reads, gh API):**
- Core nanobind-free `Tensor` + `TensorDesc` at `src/sgl/func/tensor.h:45,60`. Doc comment: "This class deliberately contains no language-binding dependency" — verbatim the issue's goal.
- The issue's flagged "key complexity" (the reflection dependency: `StridedBufferViewDesc` held `ref<NativeSlangType> dtype`) was resolved via the issue's **option 1** — the reflection type moved into core: `NativeSlangType` → nanobind-free `sgl::refl::Type` at `src/sgl/refl/type.h:48`; Python bindings kept separate in `src/slangpy_ext/refl/layout.cpp`.
- Thin Python wrapper (to_numpy/to_torch/copy_from_numpy/copy_from_torch, `nb::class_<Tensor>`) at `src/slangpy_ext/func/tensor.cpp`; dispatch `TensorMarshall` stays in `src/slangpy_ext/utils/slangpytensor.h:34`. All four of the issue's proposal points are satisfied.
- Old names `StridedBufferView`/`NativeTensor`/`NativeSlangType` are **gone from `src/`** — they survive only in auto-generated `docs/generated/api.rst` (stale, self-heals on next docs regen).

**Provenance:** landed by PR #989 "Native conversion" (merged 2026-05-18), #1000 "Native tensor" (2026-05-27), #965 "Work on improving bindings" (2026-05-29) — all inside the issue's Q2-2026 milestone. None reference #795; issue timeline has 0 cross-references → orphaned.

**Method note that mattered:** DeepWiki + 3 local subagents all reported "already done" but referenced the NEW names (`sgl::func::Tensor`) while the issue used OLD names — a mismatch that itself is the tell. Re-derived from primary source before publishing (grep 0 old names in src/, git log --follow/-S on tensor.h, gh pr view bodies, gh api issues/795/timeline). The standard slangpy checkout was NOT shallow here (973 commits), so `git log -S` dating was reliable — always check shallowness first. General pattern: a stale architecture-refactor issue is a prime silently-fixed candidate; verify the closing PRs and the issue's cross-reference timeline before treating it as open work.
