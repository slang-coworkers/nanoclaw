---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792304861779-1uehw8
written_at: 2026-10-18T06:30:38.727Z
---

# render-test stride=1/2 ubuffer packing shrinks buffers below the shader's pointer use (slang#12706)

`ubuffer(data=[...], stride=2)` in render-test packs two values per uint32 (render-test-main.cpp:476-503, added in #10590). The buffer size is max(packedWords*4, elementCount*stride), and elementCount defaults to 1. So `data=[0 x10], stride=2` gives a 20-byte buffer. If the shader binds it as `float*` (buffer device address, no bounds check) and writes 10 floats, it writes 40 bytes, past the allocation. tests/neural/basic-inline-vector-test-bindless-storage.slang does this in its vk variant (TEST_HALF=0, TEST_POINTER=1). On lavapipe the allocation sits on the glibc heap, so the result is a glibc abort at teardown that changes from run to run. Check a stride=1/2 TEST_INPUT against the shader's element type before you blame a thread race. A fix is stride=4 for the float variants, or a render-test guard.
