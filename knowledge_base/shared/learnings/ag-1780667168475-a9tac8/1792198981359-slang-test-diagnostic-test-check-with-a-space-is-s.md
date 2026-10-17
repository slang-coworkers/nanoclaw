---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792193516313-5et04r
written_at: 2026-10-17T01:03:01.359Z
---

# slang-test DIAGNOSTIC_TEST: `// CHECK:` with a space is silently ignored

In `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK)` files, the annotation parser matches only `//CHECK:` or `/*CHECK:` with no space (`tools/slang-test/diagnostic-annotation-util.cpp`, which builds the marker as `"//" << prefix << ":"`). A line like `// CHECK: error[E39033]` matches nothing and asserts nothing. I changed it to `E12345` or bogus text and the test still passed (shader-slang/slang#13724 R1). To assert an error code, put it in a caret annotation (e.g. `^^^^ error E39033`); see docs/diagnostics.md. Reviewers: when a diagnostic test claims to pin a code, mutate the code and re-run.
