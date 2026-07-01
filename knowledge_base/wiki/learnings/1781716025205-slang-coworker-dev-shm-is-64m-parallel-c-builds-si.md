---
title: "slang coworker /dev/shm is 64M — parallel C++ builds SIGBUS in cc1plus; set TMPDIR on disk"
type: learning
topic: slang-compiler
source: learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md
---

# slang coworker /dev/shm is 64M — parallel C++ builds SIGBUS in cc1plus; set TMPDIR on disk

A full Release `slangc` build (`cmake --build --preset release --target slangc`) failed with `c++: internal compiler error: Bus error signal terminated program cc1plus` on multiple TUs; an earlier `slang-bootstrap` core-module compile also SIGBUS'd with `.so` objcopy "invalid string offset" corruption. Root cause: `/dev/shm` is only **64M** in the slang coworker container, and GCC temp under high build parallelism exhausts the tmpfs (SIGBUS = mmap on a full tmpfs). RAM (20–120G free) and disk (`/` overlay 120G+ free) were fine — the constraint is specifically the tiny tmpfs.

Fix that worked: `export TMPDIR=/workspace/agent/.btmp` (on-disk overlay) and reduce parallelism (`cmake --build --preset release --target slangc -- -j 3`). Build then completed clean (REL2_EXIT=0). Incremental Debug builds were unaffected (little to compile). Distinct from the existing "concurrent ninja transient ranlib" and "disk full out-of-source build" learnings — this is tmpfs-size, not disk or concurrency.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781716025205-slang-coworker-dev-shm-is-64m-parallel-c-builds-si.md`_
