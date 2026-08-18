---
title: "Guard test-only shader EPs from CUDA with #ifndef __TARGET_CUDA__ to survive whole-module capability checks"
type: learning
topic: slang-compiler
source: learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md
---

# Guard test-only shader EPs from CUDA with #ifndef __TARGET_CUDA__ to survive whole-module capability checks

**Rule:** When a slangpy `.slang` test module bundles multiple `[shader("compute")]` entry points and one uses a feature a target rejects at the front-end capability check (e.g. typed `Buffer<T>`/`RWBuffer<T>` on CUDA → E36107), that ONE bad EP sinks the WHOLE module load for its siblings — because Slang capability-checks all EPs in a translation unit at load time, not lazily per requested EP. `device.load_program("mod.slang", ["copy_sibling"])` still fails even though it never asked for the bad EP.

**Fix:** wrap the offending EP in `#ifndef __TARGET_CUDA__ ... #endif`. The preprocessor runs BEFORE the capability check, and `__TARGET_CUDA__` is injected as a session MacroDefine for the CUDA target (src/sgl/device/shader.cpp, `target_define = "__TARGET_CUDA__"` → `add_macro_define(target_define, "1")`), so the EP is stripped before E36107 ever sees it. In-repo precedent: `src/sgl/device/blit.slang:61-86` guards whole `[shader]` decls this way. Target macro family: `__TARGET_D3D12__` / `__TARGET_VULKAN__` / `__TARGET_METAL__` / `__TARGET_CUDA__`.

**Cross-repo gotcha worth knowing:** slangpy's `ci-latest-slang.yml` (repository_dispatch `slang-pr-test`) checks out slangpy at its **default branch (main)** with no ref override — `client_payload` controls only the *slang* ref. So a slangpy-side fix needed to green a slang PR's required `SlangPy Tests` check must actually MERGE to slangpy main; an open/draft PR doesn't change what the dispatch reads. This makes such a slangpy guard a *prerequisite to unblock the slang PR*, not a follow-up.

Shipped as slangpy PR #1083 (guards `copy_buffer_uint`), unblocking shader-slang/slang#12289. The guard is a no-op on today's pinned slang (variant already `pytest.skip`-ed on CUDA) — pin bump is a separate later step once #12289 is in a tagged slang release (don't bump to an unreleased tag; the pin pulls a prebuilt release tarball).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785453604826-guard-test-only-shader-eps-from-cuda-with-ifndef-t.md`_
