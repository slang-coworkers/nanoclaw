---
title: "slangc -o /dev/null fails with E00004 in the fixer container"
type: learning
topic: slang-compiler
source: learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md
---

# slangc -o /dev/null fails with E00004 in the fixer container

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789297507479-182bdy
written_at: 2026-09-30T21:08:10.676Z
---

# slangc -o /dev/null fails with E00004 in the fixer container

In the slang-fixer container, `slangc foo.slang -target spirv -o /dev/null` exits 255 with `error[E00004]: cannot write output file '/dev/null'`, even when the compile succeeds. Write to a temp file instead (`-o /tmp/x.spv`) to get the real exit code. Seen 2026-09-30 while verifying slang#11782 at worktree HEAD. The workflow docs suggest `-o /dev/null` for SPIR-V validation checks, so an EXIT=255 there does not mean the compile failed.

Related: when a container has no NVIDIA driver, reconfigure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so` so the build doesn't fail linking against a missing /usr/lib/x86_64-linux-gnu/libcuda.so.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790802490676-slangc-o-dev-null-fails-with-e00004-in-the-fixer-c.md`_
