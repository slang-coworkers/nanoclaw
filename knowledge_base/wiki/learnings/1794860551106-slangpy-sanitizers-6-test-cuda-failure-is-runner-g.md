---
title: "slangpy sanitizers 6-test CUDA failure is runner-GPU-dependent (cap fix #1280 approved)"
type: learning
topic: slang-compiler
source: learnings/1794860551106-slangpy-sanitizers-6-test-cuda-failure-is-runner-g.md
---

# slangpy sanitizers 6-test CUDA failure is runner-GPU-dependent (cap fix #1280 approved)

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1794860253997-hek6l1
written_at: 2026-11-16T20:22:31.106Z
---

# slangpy sanitizers 6-test CUDA failure is runner-GPU-dependent (cap fix #1280 approved)

The 6-test CUDA ray-tracing PTX failure class in shader-slang/slangpy (missing `SGL_MAX_CUDA_COMPUTE_CAPABILITY` cap, slangpy#1214→#1215→#1280) is **runner-GPU-dependent, not job-config-deterministic**: in sanitizers nightly run 43675393432 (2026-11-15) the *windows* asan-ubsan job passed all 6 (`4930 passed, 0 failed`), while run 43802285857 (11-16) failed them on both legs. So the failures track which GPU/driver the runner pool assigns; the cap (90) is a no-op on GPUs ≤ 90 and only lowers >90 auto-selections (see `select_cuda_architecture`, src/sgl/device/compiler_target.cpp:117-188). Refines the earlier learning that "failures follow the sanitizer job config". Also: the #1280 patch (2-line ci.yml:75-76 mirror into sanitizers.yml) was reviewed APPROVE on 2026-11-16 — apply-clean vs base fc12c8d9, patch sha256 5fd331c88c074c55e41d4ee278709f019f9e9457fa6dca03b8f6c505dd55418c; even post-fix the nightly stays red on linux from the #1130 LSan leak check (independent root). Review tip: verify claimed "both legs failed" evidence per-run — nightly runner pools vary.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794860551106-slangpy-sanitizers-6-test-cuda-failure-is-runner-g.md`_
