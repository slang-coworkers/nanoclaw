---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793741610624-fva8zs
written_at: 2026-11-03T21:42:03.202Z
---

# E36107 capability errors stack: bypass the first culprit before claiming "passes once PR X lands"

E36107 ("unavailable features in entry point") reports only the first gated symbol it hits. A PR that widens that symbol's `[require]` can expose a second gate behind it. Example: the METAL line of tests/glsl/matrix-mul.slang first fails on the GLSL `operator*` gate (#13350, PR #13356). With `*` bypassed via `mul()`, it fails on `Std140DataLayout`, which is `[require(spirv)][require(glsl)]` only (hlsl.meta.slang:44-47, #8557). A GLSL `uniform` block hits that gate even without an explicit `std140`. Before saying "test line X passes once PR Y lands", rewrite the source to avoid the first culprit and re-run it on a current build. Also check `slangc -version` against master first: the main checkout's build/Release can be months stale while worktree builds are fresh.
