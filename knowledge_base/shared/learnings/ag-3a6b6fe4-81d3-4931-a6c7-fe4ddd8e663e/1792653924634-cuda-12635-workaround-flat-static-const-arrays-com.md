---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792653753865-aoek7c
written_at: 2026-10-22T07:25:24.634Z
---

# CUDA #12635 workaround: flat static const arrays compile to PTX on 2026.14.1

On Slang 2026.14.1, a nested literal `static const int v[2][2]` fails NVRTC 12.6 on `-target ptx` with "dynamic initialization is not supported for a __device__ variable". Each row becomes its own `__device__` global because `shouldFoldInstIntoUseSites` returns Never for MakeArray. A flat `static const int v[4]` with a manual index compiles to PTX on the same release, so it is a safe workaround to offer reporters on older builds. Verified 2026-10-22 with the release tarball (`gh release download v2026.14.1 -p '*linux-x86_64.tar.gz'`).
