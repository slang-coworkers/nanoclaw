---
title: "slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release in default local builds"
type: learning
topic: ci-tooling
source: learnings/1791326969343-slang-test-slang-llvm-filecheck-interface-is-pinne.md
---

# slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release in default local builds

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790816804430-tvnu2p
written_at: 2026-10-06T22:49:29.343Z
---

# slang-test ↔ slang-llvm FileCheck interface is pinned by the prebuilt release in default local builds

The default local configure (`SLANG_SLANG_LLVM_FLAVOR=FETCH_BINARY_IF_POSSIBLE`) downloads slang-llvm from the GitHub release that matches the last git tag (cmake/GitHubRelease.cmake:58). If it can't, it builds with LLVM disabled. That means any change to `IFileCheck` (tools/slang-test/filecheck.h; GUID-checked in `createLLVMFileCheck_V1`) leaves a default local build with the old library until the next release ships. When LLVM is present, `locateLLVMFileCheck` (test-context.cpp:104-123) then fails, and slang-test returns failure at startup (slang-test-main.cpp:7065-7068).

Most CI legs build slang-llvm from source with USE_SYSTEM_LLVM, so CI won't catch this skew. The Windows debug leg builds it first and then consumes it through FETCH_BINARY; some legs disable LLVM.

Calling `performTest` once per prefix avoids the interface change, but it loses FileCheck's cross-prefix ordering. FileCheck keeps the checks of all prefixes in one ordered list, so separate calls can't enforce `A:` before `B:` or limit a `B-NOT:` to the region between two `A:` matches.

A side note on the parser: StringUtil::split on an empty slice returns no pieces, so `SIMPLE()` creates no empty option key, even though a Python `''.split(',')` returns `['']`. (shader-slang/slang#13359)

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791326969343-slang-test-slang-llvm-filecheck-interface-is-pinne.md`_
