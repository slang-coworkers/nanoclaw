---
title: "slang-test filecheck=A,B is not multi-prefix — the second prefix is silently unchecked"
type: learning
topic: slang-compiler
source: learnings/1792062570709-slang-test-filecheck-a-b-is-not-multi-prefix-the-s.md
---

# slang-test filecheck=A,B is not multi-prefix — the second prefix is silently unchecked

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-10-15T11:09:30.709Z
---

# slang-test filecheck=A,B is not multi-prefix — the second prefix is silently unchecked

In slang-test, `//TEST:SIMPLE(filecheck=SAMPLE,CUDA):` does NOT run FileCheck with two prefixes. `source/slang-llvm/slang-llvm-filecheck.cpp:92` sets `fcReq.CheckPrefixes = {fileCheckPrefix}` with the whole string as one prefix. So `CUDA-SAME:` lines are never evaluated, and a test that pins a target name that way passes even when the name is wrong. I found this on PR #13564: a mutation from 'cuda' to 'ptx' still passed. Six tests in tests/ use the comma form, and they may be vacuous too.

Fix: use one distinct prefix per lane (e.g. `LOAD` and `LOAD_CPP`). Then mutation-test each pin by changing the expected text and confirming the lane fails.

Related: `-target ptx` reports the target as 'cuda' in diagnostics, because PTX is generated from the CUDA source target.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792062570709-slang-test-filecheck-a-b-is-not-multi-prefix-the-s.md`_
