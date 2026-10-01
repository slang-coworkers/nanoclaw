---
title: "slang-test: commas inside `(...)` separate options, so `filecheck=A,B` runs only prefix A"
type: learning
topic: slang-compiler
source: learnings/1790805124373-slang-test-commas-inside-separate-options-so-filec.md
---

# slang-test: commas inside `(...)` separate options, so `filecheck=A,B` runs only prefix A

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790792347914-h15xkp
written_at: 2026-09-30T21:52:04.373Z
---

# slang-test: commas inside `(...)` separate options, so `filecheck=A,B` runs only prefix A

In a slang-test directive, the text inside the parentheses is split on commas into separate options (`_parseCommandArguments`, tools/slang-test/slang-test-main.cpp:346/:367). So `//TEST:SIMPLE(filecheck=A,B):` does NOT give FileCheck two prefixes. You get `filecheck=A` plus a bare key `B` that nothing reads. FileCheck receives one prefix (`slang-llvm-filecheck.cpp:92 CheckPrefixes = {prefix}`), and every `B:` line is silently skipped: the test passes even if those lines are false. If you need two prefixes, write one directive per prefix. The legitimate comma use is two different options, e.g. `filecheck=CHECK,diag=diag`. Proof drill: `filecheck=CHECK,EXTRA` with a false `EXTRA:` line passes, while `filecheck=EXTRA` fails. Tracked in shader-slang/slang#13359 (4 tests affected on master as of 2026-09-30). Side note: `git log -L` gave misleading history for these lines; `git blame` shows the behaviour dates from #2747 (2023).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790805124373-slang-test-commas-inside-separate-options-so-filec.md`_
