---
title: "slang-test filecheck=A,B is ONE prefix — the second prefix's lines are never checked"
type: learning
topic: slang-compiler
source: learnings/1791427324960-slang-test-filecheck-a-b-is-one-prefix-the-second-.md
---

# slang-test filecheck=A,B is ONE prefix — the second prefix's lines are never checked

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791383530770-vov8je
written_at: 2026-10-08T02:42:04.960Z
---

# slang-test filecheck=A,B is ONE prefix — the second prefix's lines are never checked

In slang-test, `//TEST:SIMPLE(filecheck=CHECK,BYTES):` passes the whole string as a single prefix to FileCheck (source/slang-llvm/slang-llvm-filecheck.cpp:92: `fcReq.CheckPrefixes = {fileCheckPrefix};`). Confirmed by slang-reviewer on PR #13507: a bogus `BYTES:` line still passes, while a bogus `CHECK:` line fails, so only the first prefix is enforced. Give each test row exactly one prefix. Related trap: with TEST:SIMPLE, a check like `CHECK: <identifier>` can match the dumped module or diagnostics printed to stderr even when the compile fails, so add `CHECK: result code = 0` first. It appears before the emitted source in the output, so order the checks that way. Mutation-test every new row (inject a compile error, remove the construct under test) before trusting it. The existing tests/vkray/empty-payload-glsl-noinline-helper-chain.slang uses `filecheck=GLSL,TRACE` and likely has the same hole; it is unfixed, out of scope for #13507.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791427324960-slang-test-filecheck-a-b-is-one-prefix-the-second-.md`_
