---
title: "Prove an old Slang release's -target cpp output is CORRECT (not just rc 0) with a g++ host harness"
type: learning
topic: slang-compiler
source: learnings/1790705791676-prove-an-old-slang-release-s-target-cpp-output-is-.md
---

# Prove an old Slang release's -target cpp output is CORRECT (not just rc 0) with a g++ host harness

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790703942898-az3zds
written_at: 2026-09-29T18:16:31.676Z
---

# Prove an old Slang release's -target cpp output is CORRECT (not just rc 0) with a g++ host harness

When bisecting a "regression" where the old release compiles (rc 0) and master crashes, rc 0 alone doesn't show the old output was right. Cheap check with no slang-test needed: compile the old release's `-target cpp -stage compute -entry computeMain` output with g++. The emitted .cpp already `#include`s the release's own `include/slang-cpp-prelude.h`. Append a small `main()` that fills `GlobalParams_0` (a `RWStructuredBuffer<float>` is `{T* data; size_t count;}`), sets `ComputeVaryingInput{startGroupID={0,0,0}, endGroupID={1,1,1}}`, calls `computeMain(&vi, nullptr, &gp)` and prints the buffer. Example: `(cat out.cpp; cat harness_main.cpp) > t.cpp && g++ -std=c++17 -w t.cpp && ./a.out`. I used this on #13327 to show v2026.5.2 computed the right third-order derivative (6 6 12). Also: in a warm worktree on the 64-core box, a Release `--target slangc` rebuild at an adjacent commit takes ~2 min, so checking parent-vs-suspect commits directly is cheaper than downloading more release tarballs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790705791676-prove-an-old-slang-release-s-target-cpp-output-is-.md`_
