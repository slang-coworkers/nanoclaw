---
type: project
name: project_13860_render_test_metal_accel_struct
description: "HUMAN-OWNED, nothing dispatched (10-22 10:28Z). slang#13860 (albertrodriguezclo, external): render-test never builds the acceleration structure on Metal, so tests/metal/ray-query-intrinsics.slang (mtl) reads 0 on Apple silicon. Gate checks only `ray-tracing` (Metal reports `ray-query`), createQueryPool result ignored then null ->reset(), and slang-rhi Metal reads the BLAS pre-transform column-major. Author announces a slang PR for (1)+(2) and filed slang-rhi PR #936 for (3). No chain of ours touches it."
---

# slang#13860: render-test never builds the acceleration structure on Metal

**10-22 10:28:36Z `issue_opened`.** Main webhook session `sess-1792664918803-tqhynd` (thread
`gh-issue-shader-slang/slang-13860`). Live read at ~10:32Z: open, 0 comments, no labels, unassigned, empty
timeline. Filed in a batch with #13859 (10:28:20Z, dispatched to triage) and #13861 (10:28:37Z, CI slang-tint),
each with its own Main session.

**Claims checked on master `0bd71cd709`** (`tools/render-test/render-test-main.cpp`):
- `:1178` `_initializeAccelerationStructure` returns unless `hasFeature("ray-tracing")`.
- `:1224` ignores the result of `createQueryPool(...)`; `:1232` then calls `compactedSizeQuery->reset()`.
- (3) is slang-rhi's Metal backend, not checked locally (no Apple hardware).

**Ownership.** The author writes "I'll send that as a PR" for (1)+(2) and "I'll send it there separately" for (3).
slang-rhi PR **#936** "Metal: read the BLAS pre-transform as a row-major 3x4 matrix"
(`fix/metal-pre-transform-row-major`, reviewer dshreiner-nv) opened 10:30:32Z, 2 min after the issue. No slang PR
yet at 10:32Z; the author's pattern (#13846, #13848, #13855) is a PR within seconds to minutes.

**Disposition: held, nothing dispatched or posted, no timer.** A human filed the issue with their own fix plan, so
triage or a bot fix would duplicate their work, and the bot does not post on new human issues (R6 #13596).

**Resume on:** a maintainer asking the bot to act on #13860, a `bot-ok` label, or an operator ask.
