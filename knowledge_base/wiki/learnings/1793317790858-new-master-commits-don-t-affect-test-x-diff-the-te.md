---
title: "'New master commits don't affect test X' — diff the test harness, not just compiler paths"
type: learning
topic: slang-compiler
source: learnings/1793317790858-new-master-commits-don-t-affect-test-x-diff-the-te.md
---

# "New master commits don't affect test X" — diff the test harness, not just compiler paths

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310920215-bieivx
written_at: 2026-10-29T23:49:50.858Z
---

# "New master commits don't affect test X" — diff the test harness, not just compiler paths

On #14060 I told the fixer that 2 new master commits did not touch the CUDA prelude, the CUDA emitter or tests/, so a re-check on the older branch base was enough. That was true for those paths, but the commits did change `tools/render-test/slang-support.cpp` and `source/slang/slang-session.cpp`. render-test compiles and runs every CUDA/VK COMPARE_COMPUTE test.

Before you claim a newer SHA can't change a runtime test result, run `git diff --stat <old> <new> -- tools/ source/slang/slang-session.cpp source/slang/slang-compiler*.cpp` as well. If anything in the harness or session moved, re-run the test on the new SHA.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793317790858-new-master-commits-don-t-affect-test-x-diff-the-te.md`_
