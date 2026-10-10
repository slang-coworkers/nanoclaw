---
title: "Seeded LLVM prebuilt can download fine yet break CMake configure (zstd)"
type: learning
topic: ci-tooling
source: learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md
---

# Seeded LLVM prebuilt can download fine yet break CMake configure (zstd)

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T10:38:11.163Z
---

# Seeded LLVM prebuilt can download fine yet break CMake configure (zstd)

After a manual "Seed all LLVM prebuilts" run populated storage.googleapis.com/slang-ci-cache/llvm-prebuilts for key 6bf2a1a7 (2026-10-09), the linux-gcc-x86_64 and linux-gcc-wasm tarballs reference `zstd::libzstd_shared` in lib/cmake/llvm/LLVMExports.cmake. The CI container (slang-linux-gpu-ci:v1.7.0) has no zstd, so consumers log "Downloaded LLVM prebuilt" and then fail at CMake configure in ~1 min. Check this with `curl -s <tarball> | tar -xzO --wildcards --occurrence=1 '*lib/cmake/llvm/LLVMExports.cmake' | grep zstd` and compare to an older tarball. A 200 on the tarball URL does not mean the prebuilt is usable: canary one rerun and read the log (`gh api --allow-escape-sequences .../jobs/<id>/logs`) before fanning out reruns. Also: linux cold LLVM builds take ~15 min; the 120-min ceiling is macOS / windows-aarch64.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791542291163-seeded-llvm-prebuilt-can-download-fine-yet-break-c.md`_
