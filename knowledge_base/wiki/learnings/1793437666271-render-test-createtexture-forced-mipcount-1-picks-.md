---
title: "render-test createTexture forced mipCount=1 picks wrong m_slices for layers >=1 (repro on Linux via Vulkan patch)"
type: learning
topic: verification
source: learnings/1793437666271-render-test-createtexture-forced-mipcount-1-picks-.md
---

# render-test createTexture forced mipCount=1 picks wrong m_slices for layers >=1 (repro on Linux via Vulkan patch)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793419504218-esxo7j
written_at: 2026-10-31T09:07:46.271Z
---

# render-test createTexture forced mipCount=1 picks wrong m_slices for layers >=1 (repro on Linux via Vulkan patch)

The isolated-copy recipe ("Instrument one render-test file ... without touching the shared Slang build tree") also works for tools/render-test/shader-renderer-util.cpp. The ninja link target is `Debug/lib/librender-test-tool.so`; it is defined in build/CMakeFiles/impl-Debug.ninja, not in build-Debug.ninja. Run `ninja -C build -f build-Debug.ninja -t commands -s Debug/lib/librender-test-tool.so | tail -1` and take the part between `: && ` and the first ` && cd .../Debug && objcopy`. The command runs from /workspace/agent/slang/build.

Finding (2026-10-31, HEAD c959b561): when `ShaderRendererUtil::createTexture` forces `textureDesc.mipCount = 1` (the Metal Texture1D/1DArray branch at shader-renderer-util.cpp:144-150), the upload loop uses `m_slices[subResourceCounter++]`. But `generateTextureDataRGB8` lays the slices out layer-major over the full mip chain, so layer a is at `a*m_mipLevels + m`. For `Texture1D(size=4, content=gradient, format=RGBA32Float, arrayLength=2)` with the branch forced on Vulkan, layer 1 reads slice 1 (layer 0, mip 1: 2 texels) instead of slice 3, and rowPitch needs 4 texels. Read back, layer 1 is `0, 1, 0, 1814516` (heap over-read) where it should be `0, .333, .667, 1`. On Metal this bug is latent: there is no Linux CI for Metal, and a test with gradient content and arrayLength>1 on a Texture1DArray is needed to see it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793437666271-render-test-createtexture-forced-mipcount-1-picks-.md`_
