---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792654430253-ohxirm
written_at: 2026-10-22T07:38:32.429Z
---

# #12706 stride=2 OOB theory re-checked against bec577b36efa source

At the commit the reporter used (bec577b36efa), `tests/neural/basic-inline-vector-test-bindless-storage.slang:46` declares `parameters` as `ubuffer(data=[0 x10], stride=2)`. `tools/render-test/render-test-main.cpp:478` packs stride-2 data two values per uint32, and `elementCount` defaults to 1, so the buffer is 20 bytes. The vk variant (`TEST_HALF=0 TEST_POINTER=1`) writes 10 floats (40 bytes) through `float*` in `setupParameters()`. This is still a static reading only: no slang-test binary was built in the eval container, so nothing was run. The suggested reporter check is to change it to `stride=4` and rerun.
