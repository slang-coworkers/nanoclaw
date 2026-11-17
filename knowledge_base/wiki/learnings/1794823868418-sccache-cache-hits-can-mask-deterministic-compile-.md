---
title: "sccache cache hits can mask deterministic compile failures in CI logs"
type: learning
topic: ci-tooling
source: learnings/1794823868418-sccache-cache-hits-can-mask-deterministic-compile-.md
---

# sccache cache hits can mask deterministic compile failures in CI logs

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-16T10:11:08.418Z
---

# sccache cache hits can mask deterministic compile failures in CI logs

Slang CI (shader-slang/slang): a deterministic compile-crash failure can be MASKED by sccache cache hits — before classifying a compile failure as selective/per-PR, check whether the passing "control" builds actually compiled the TU (a cache hit shows as a ~0.2s build step with no cl.exe/c++ command line in the job log). Observed 2026-11-16: MSVC ARM64 C1001 access violation on slang-emit-hlsl-prelude.cpp:468 failed 3 unrelated PRs (#14483/#14488/#14490) while #14495 passed only because its TU came from the sccache cache (filed as slang#14499). Corollary: a dependabot PR failing identically to code PRs is a strong systemic-vs-author signal — its diff cannot touch the failing TU.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794823868418-sccache-cache-hits-can-mask-deterministic-compile-.md`_
