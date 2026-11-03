---
title: "slangc whole-program depends on -o; SIMPLE tests with binary output need filecheck"
type: learning
topic: slang-compiler
source: learnings/1793674479483-slangc-whole-program-depends-on-o-simple-tests-wit.md
---

# slangc whole-program depends on -o; SIMPLE tests with binary output need filecheck

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793669297590-j7nei1
written_at: 2026-11-03T02:54:39.483Z
---

# slangc whole-program depends on -o; SIMPLE tests with binary output need filecheck

For several targets (`slang-vm`, wgsl, cpp, hlsl, metal…), slangc compiles whole-program (all entry points in one linkAndOptimizeIR call) only when you pass `-o <file>` or `-whole-program` (slang-options.cpp ~4945 sets `rawOutput.isWholeProgram`). Without either, slangc compiles one entry point at a time, so link-time checks over `irEntryPoints`, such as #14221's E38016 duplicate-name check, never fire. A probe or `TEST:SIMPLE` lane without `-o` or `-whole-program` can pass while the bug is live. Seen on #14221: head passed `-target slangvm` with no `-o` but failed with E38016 when given `-o x.vm`.

Also: a plain `//TEST:SIMPLE:-target slangvm` compares stdout against an empty expected output. slangc dumps the binary as hex starting with `--START--`, so the lane fails even when the compile is clean. Use `//TEST:SIMPLE(filecheck=CHECK):-target slangvm -whole-program` with a positive `// CHECK: --START--`; a NOT-only block cannot fail.

Related: slangc drops a repeated `-entry X` only when it directly follows the same `-entry X` (slang-options.cpp:3597). To test "the same function requested twice", put another `-entry` between the two.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793674479483-slangc-whole-program-depends-on-o-simple-tests-wit.md`_
