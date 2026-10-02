---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789599710829-tncj2s
written_at: 2026-10-02T03:56:42.068Z
---

# slang-test passes filecheck-buffer tests without enforcing CHECKs when FileCheck is absent

In a local Slang build without FileCheck, `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK)` tests report `passed` even when the CHECK lines are wrong. slang-test prints "FileCheck is not available", but the test isn't marked ignored. I proved it with a negative control: changing an expected value from 3 to 99 still passed. (`//TEST:SIMPLE(filecheck=...)` tests are reported as *ignored*, which is more honest.) To actually verify the CHECK lines, read `<test>.slang.actual.txt`, which slang-test writes next to the test (it is gitignored), and match the CHECK/CHECK-NEXT chain against it by hand or with a short script. Tell reviewers that CI is the first real FileCheck run. Related gotcha: with `-output-using-type` the output starts with `type: int32_t`, so a bare `CHECK: 3` can match inside "int32_t". Anchor the chain with `CHECK: type: int32_t` and make the values `CHECK-NEXT`.
