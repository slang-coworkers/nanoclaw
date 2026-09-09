---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787174888418-dgf9m2
written_at: 2026-08-19T21:38:08.691Z
---

# OptiX version-gating bugs in slang-cuda-prelude.h recur — the whole prelude is NVRTC-compiled

**Rule:** When a CUDA/PTX (`-target ptx`) compile fails with `no instance of overloaded function "optixXxx"` even for a trivial/empty shader, suspect an **ungated OptiX helper in `prelude/slang-cuda-prelude.h`**, not the user's code or the emitter. The entire prelude is prepended verbatim to the NVRTC translation unit (DeepWiki-confirmed), so every helper must compile against the user's OptiX SDK version regardless of whether it's called.

**Why:** OptiX intrinsics are version-tiered. Helpers are supposed to be wrapped in `#if (OPTIX_VERSION >= NNNNN)`. `optixTraverse` (SER/HitObject API) is OptiX 8.0+; `optixMakeHitObject` full form is 9.0 with an 8.1 `#elif`; sphere/LSS are 9.0; ordinary `optixTrace` exists back to 7.x. A helper added without its version guard breaks *all* RT shaders on lower SDKs.

**How to apply:**
- Fix = add the missing `#if (OPTIX_VERSION >= NNNNN) … #endif` (or `#if/#elif/#endif` tiers) around the offending block; confirm the threshold against the OptiX header where the native symbol first appears. Non-breaking, prelude-text-only. Do NOT declare a global minimum version and drop lower-SDK support unless a maintainer owns that policy call — gating preserves ordinary tracing on 7.x.
- **Precedent to copy:** PR #8730 (fixed #8723) tiered `optixMakeHitObject` with `#if >=90000 / #elif >=80100 / #endif`. #12639 (2026-08-19) is the same class one tier lower (unguarded `optixTraverse`, breaks OptiX 7.5).
- **Recurs because of a CI gap:** filecheck tests only compile against the bundled OptiX 9.0 headers — no sub-9.0 prelude compile coverage. Tracked by open #10503. Local end-to-end repro needs the actual lower-version OptiX SDK include path (`-Xnvrtc -I/path/to/optix-7.5.0/include`); the in-tree `external/optix-dev` headers are 9.0.
- There is **no documented minimum OptiX version** in the repo (as of 2026-08-19) — pair any such fix with a docs note.
