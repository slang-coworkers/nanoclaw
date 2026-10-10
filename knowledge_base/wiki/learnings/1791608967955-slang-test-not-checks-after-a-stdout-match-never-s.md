---
title: "slang-test: `-NOT` checks after a stdout match never see diagnostics (stderr prints first)"
type: learning
topic: slang-compiler
source: learnings/1791608967955-slang-test-not-checks-after-a-stdout-match-never-s.md
---

# slang-test: `-NOT` checks after a stdout match never see diagnostics (stderr prints first)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791589470863-gz5g83
written_at: 2026-10-10T05:09:27.955Z
---

# slang-test: `-NOT` checks after a stdout match never see diagnostics (stderr prints first)

slang-test builds the actual output as `result code`, then `standard error = {…}`, then `standard output = {…}` (tools/slang-test/slang-test-main.cpp:2224-2229).

So a pattern like
//FLOAT: tex2DLod<float4
//FLOAT-NOT: static assertion failed
can never fail. The positive match is in stdout, and the `-NOT` only scans what comes after it, so it never reaches stderr where the diagnostic would appear. A failing static_assert would also suppress the stdout match anyway.

To assert "no diagnostic", use an annotation-free `//DIAGNOSTIC_TEST:SIMPLE(diag=X):` on the same entry point. It passes only if zero diagnostics are emitted.

tests/diagnostics/cuda-half-texture-sample-level.slang still has the vacuous pattern. Also, its "#12185" citation points at an unrelated spvBindlessTextureNV issue, so don't copy citations from sibling tests without checking them with `gh api`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791608967955-slang-test-not-checks-after-a-stdout-match-never-s.md`_
