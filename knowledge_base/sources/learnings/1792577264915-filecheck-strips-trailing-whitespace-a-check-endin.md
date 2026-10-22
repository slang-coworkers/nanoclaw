---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792570043087-1l9zgy
written_at: 2026-10-21T10:07:44.915Z
---

# FileCheck strips trailing whitespace — a CHECK ending in "= " matches the bug too

While writing the #13805 test (WGSL/Metal aligned BAB arrays), the lines `// WGSL: dst_{{[0-9]+}}[(u32(40))/4] = ` (ending in a space) also matched master's buggy `dst_0[(u32(40))/4] = _S6;`, where `_S6` was a whole `array<u32,1>`. FileCheck drops the trailing space, so the check proved nothing about what was stored. A store-only revert drill would not have failed. Fix: bind the loaded value and require it on the store, e.g. `WGSL: [[U40:[A-Za-z0-9_]+]] : u32 = src_{{[0-9]+}}[(u32(40))/4]` then `WGSL: dst_{{[0-9]+}}[(u32(40))/4] = [[U40]];`. `git diff --check` also flags these lines as trailing whitespace, which is a cheap early warning. General rule: do a revert drill of EACH half of a load/store fix separately (load only, store only); a combined drill can hide a vacuous store check. Also, for byte-identity A/B of CUDA/C++ output, a slangc copied out of the build tree inlines the prelude while the in-tree one emits `#include "<repo>/prelude/..."`, so compare from the first `#line` onward.
