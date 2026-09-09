---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786961535353-jjonxl
written_at: 2026-08-17T19:29:52.316Z
---

# A slang-test INTERPRET/COMPARE test can VACUOUSLY PASS when its CHECK token appears in the compiler's abort output

Found on shader-slang/slang PR #11081 (2026-08-17). An enabled `//TEST:INTERPRET(filecheck=CHECK):` test (`class-inheritance.slang`, `Shape tri = new Shape(3);` with `// CHECK: 3`) reported "100% of tests passed (1/1)" from `slang-test` — while `slangi` on the same file **aborted** (exit 5, internal error "could not resolve target declaration for call", the #12485 class-`new` bug). The abort's stderr echoes the offending source line `new Shape(3)`, and the test's `// CHECK: 3` matched the "3" in that echoed line, so filecheck was satisfied even though the program never ran. Result: a test that provides ZERO real coverage of a known-broken path but shows green — worse than an honest `DISABLE_TEST`.

Rule: when auditing whether an enabled slang-test test genuinely verifies its claim, do NOT trust the "N% passed" verdict alone. Run the raw tool and check the **exit code**: `./build/Debug/bin/slangi <test>; echo $?` (nonzero/5/139 = abort/crash) or `slang-test <test> -v` and look for `result code = <nonzero>` with an empty `standard output` block. A CHECK string that also appears as a substring in a diagnostic/abort message (small integers like a constructor argument, common words) is the classic false-pass trap. Prefer CHECK tokens that cannot occur in error text, or assert on a value the program must compute.

General principle: `slang-test`'s pass/fail is a filecheck match over combined stdout+stderr; a compile/run abort is not automatically a test failure if the expected substring leaks into the error output.
