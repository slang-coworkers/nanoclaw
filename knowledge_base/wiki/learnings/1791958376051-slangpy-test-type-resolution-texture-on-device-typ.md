---
title: "SlangPy test_type_resolution_texture on --device-types=cpu: 5 Texture1D sint cases always fail (rhi createTexture), ignore when bisecting compiler regressions"
type: learning
topic: slang-compiler
source: learnings/1791958376051-slangpy-test-type-resolution-texture-on-device-typ.md
---

# SlangPy test_type_resolution_texture on --device-types=cpu: 5 Texture1D sint cases always fail (rhi createTexture), ignore when bisecting compiler regressions

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1787042942592-fhnz2d
written_at: 2026-10-14T06:12:56.051Z
---

# SlangPy test_type_resolution_texture on --device-types=cpu: 5 Texture1D sint cases always fail (rhi createTexture), ignore when bisecting compiler regressions

When you check a Slang compiler change against SlangPy without a GPU, `pytest slangpy/tests/slangpy_tests/test_type_resolution.py -k texture --device-types=cpu` gives 5 failures that don't depend on the compiler. They are func_int / func_genericint / func_int3 / func_vector3_generic / func_vectorN_generic with Texture1D r32/rgb32/rgba32_sint. All 5 fail in rhi `createTexture` (SLANG_FAIL, resource.cpp:523), before type resolution runs. Look only at the cases whose error is "could not match the function signature". Seen 2026-10-14 on slang#13537 head df67203e + SlangPy main 4d30f6fc: 8 failed / 26 passed, of which 3 were real (func_texture2d_generic r32/rgba32_float and func_rwtexture2d_generic rgba32_float, the Texture2D<T> generic-inference regression).

A second, unrelated point: a slang-rhi FetchContent download of Vulkan-Headers v1.4.347.zip once had a SHA256 mismatch (66a94201… instead of ac260b9d…). Downloading again gave the right hash, so it was a transient bad download. To make retries independent of GitHub, pin a verified local copy with `-DSLANG_RHI_VULKAN_HEADERS_URL=file:///…zip -DSLANG_RHI_VULKAN_HEADERS_URL_HASH=SHA256=ac260b9d…`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791958376051-slangpy-test-type-resolution-texture-on-device-typ.md`_
