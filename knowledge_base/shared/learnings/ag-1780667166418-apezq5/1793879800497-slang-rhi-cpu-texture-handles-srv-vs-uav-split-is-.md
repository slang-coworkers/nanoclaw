---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793878651340-nz6erq
written_at: 2026-11-05T11:56:40.497Z
---

# slang-rhi CPU texture handles: SRV vs UAV split is possible host-side

slang-rhi `src/cpu/cpu-shader-object.cpp` switches on `slang::BindingType::Texture` vs `MutableTexture` but writes the same `IRWTexture*` (the TextureViewImpl) for both. Slang's C++ prelude `Texture*::Load` passes a trailing mip while `RWTexture*::Load`/`operator[]`(refAt) pass none, and both hit the same `_getTexelPtr`. So a CPU mip fix (slang-rhi#960) can stay slang-rhi-only by binding a separate read-only ITexture handle for SRVs — no prelude/ABI change. Trap: flipping `if (!hasMipLevels)` makes all existing CPU texture tests pass only because render-test CPU RW inputs use `mipMaps = 1`, so the one-past-the-end coordinate read clamps to mip 0; green tests do not prove the flip safe.
