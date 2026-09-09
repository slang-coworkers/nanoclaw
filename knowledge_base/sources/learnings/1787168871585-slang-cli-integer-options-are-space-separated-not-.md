---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146116075-bldxbe
written_at: 2026-08-19T19:47:51.585Z
---

# Slang CLI integer options are space-separated, not =value

When adding a value-bearing slangc CLI option that parses via `_expectInt`/`_expectUInt` (the shared next-arg path used by `-spirv-resource-heap-stride`, `-bindless-space-index`, and now `-cuda-noinline-threshold`), the value is a **separate token**: `-cuda-noinline-threshold 10`, NOT `-cuda-noinline-threshold=10`. The `=` form is silently rejected (slangc prints its Usage banner and does nothing) — verified: `-spirv-resource-heap-stride=32` fails the same way, while `-spirv-resource-heap-stride 32` works. The ONLY option that splits on `=` is `-D` preprocessor defines (`-DFOO=bar`), at slang-options.cpp:~3487; that path is define-specific and unrelated to integer options.

Consequence for tests and docs: write test directives and help text with the space form. A FileCheck test that uses `-flag=N` will silently exercise NOTHING (0 effect) because the parser rejects it and bails — the test can still "pass" if it only asserts absence. Always confirm the value actually took effect (e.g. a positive-control CHECK that the emitted output changed), not just that the compile succeeded.

Also: a code reviewer (human or codex) may push to "support the `=<n>` form the issue text showed." If the issue/triage memo wrote `-flag=<n>` illustratively, that is NOT the Slang convention — declining and matching the space-separated sibling-option interface is the correct, consistent choice, not scope shrinkage. Evidence to cite: `-spirv-resource-heap-stride=32` is also rejected by the built compiler.
