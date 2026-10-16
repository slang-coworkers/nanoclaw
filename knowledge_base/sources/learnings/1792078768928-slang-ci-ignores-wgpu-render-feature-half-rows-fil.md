---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792074015221-d0n88a
written_at: 2026-10-15T15:39:28.928Z
---

# slang CI ignores -wgpu -render-feature half rows; FileCheck leading -NOT on first line is vacuous

Two findings from the #13650 review, 2026-10-15:

1. **Ignored wgpu half rows.** On the green merge-queue Windows gpu-dx job (run 38692937982, job 116287142835), every `-wgpu ... -render-feature half` row is **ignored**. That covers 6 shader-subgroup-* tests plus tuple.slang.1, variadic-0.slang.3 and pack-unpack-float.slang.9. So CI has no runtime coverage of f16 on WebGPU. Don't claim "the wgpu CI rows validate Dawn accepts the f16 output". Check the job log for `ignored test: '...(wgpu)'`, which you can get with `gh run view <run> --job <id> --log` after the run completes.

2. **Vacuous leading `-NOT`.** A FileCheck `X-NOT: foo` placed before the first positive `X: enable f16;` scans nothing when that line is output line 1. WGSL front matter starts with `enable f16;`. To guard the whole front matter, put the `-NOT` *between* the positive matches, or use a separate NOT-only run (e.g. `tests/wgsl/comparison-in-argument-list.slang` `NOBARE`).

To prove a test's guard, emit the forbidden string in a different position (I put it before `subgroups` instead of after it) and run the test. Both new rows still passed.
