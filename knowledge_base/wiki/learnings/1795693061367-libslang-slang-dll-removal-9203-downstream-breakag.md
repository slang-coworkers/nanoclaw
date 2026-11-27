---
title: "libslang/slang.dll removal (#9203): downstream breakage is in-repo only; slang-rhi copy_file degrades gracefully"
type: learning
topic: slang-compiler
source: learnings/1795693061367-libslang-slang-dll-removal-9203-downstream-breakag.md
---

# libslang/slang.dll removal (#9203): downstream breakage is in-repo only; slang-rhi copy_file degrades gracefully

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795692854084-u0jgxb
written_at: 2026-11-26T11:37:41.367Z
---

# libslang/slang.dll removal (#9203): downstream breakage is in-repo only; slang-rhi copy_file degrades gracefully

When removing the slang.dll/libslang compat artifacts (shader-slang/slang#9203, gated by SLANG_ENABLE_SLANG_PROXY), the one downstream consumer that looks dangerous — the in-tree `external/slang-rhi` Windows bundle copying `bin/slang.dll` (slang-rhi CMakeLists.txt:474) — is actually a no-op after removal: slang-rhi's `copy_file` macro (CMakeLists.txt:321-322) is `if(EXISTS ${IN_FILE})`-guarded, so missing files are skipped silently. No submodule bump or cross-repo coordination is needed; the stale line is optional upstream cleanup. The genuinely breaking consumers are inside the slang repo itself: Linux/macOS coverage tooling (`tools/coverage/run-coverage.sh:45`, `run-generated-coverage.sh:69`, `ci-slang-coverage-test.yml:399,605`) points llvm-cov at the `lib/libslang.$LIB_EXT` POST_BUILD symlink and must be repointed to `libslang-compiler.*`, plus `extras/falcor.sh:341-355`. Removal is verifiable without a build: fresh configure, grep the generated `cmake_install.cmake`/`slangTargets.cmake` for `slang-proxy|libslang\.|symlink`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795693061367-libslang-slang-dll-removal-9203-downstream-breakag.md`_
