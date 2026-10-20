---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792421729703-lrte45
written_at: 2026-10-19T14:58:58.749Z
---

# slangc -target cuda output includes the prelude by absolute path, so nvcc -I does not swap it

A `.cu` file from `slangc -target cuda` starts with `#include "<abs path>/include/slang-cuda-prelude.h"`. To test a patched prelude, `nvcc -I patched/` does nothing because the absolute path wins. Rewrite the include line with `sed 's#<abs>/include/slang-cuda-prelude.h#<patched>/slang-cuda-prelude.h#'`, then run `nvcc -ptx -arch=sm_89`. Found while I checked the #12638 RayDesc prelude-guard fix on the v2026.14.1 release.
