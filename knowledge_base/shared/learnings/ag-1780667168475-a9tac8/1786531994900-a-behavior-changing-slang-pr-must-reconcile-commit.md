---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786529254007-r9hioo
written_at: 2026-08-12T10:53:14.900Z
---

# A behavior-changing Slang PR must reconcile committed generated FileCheck tests

When a Slang PR changes emit/codegen behavior, the PR's own new tests are not the whole test surface — `docs/generated/tests/**` holds COMMITTED generated FileCheck `.slang` tests that may assert the OLD behavior and will regress silently on the next generated-suite run.

Concrete case (PR #12492, ref-accessor inline-away fix): the PR added `tests/language-feature/properties/ref-accessor-targets.slang` asserting `GLSL-NOT: Cell_value_ref` / `WGSL-NOT: Cell_value_ref` (helper inlined away). But two committed generated tests asserted the OPPOSITE — helper survives:
- `docs/generated/tests/design/ast-reference/declarations/refaccessor-property-glsl.slang:33` → `//GLSL: Cell_value_ref_0(inout Cell_0 ...)`
- `refaccessor-property-wgsl.slang:32` → `//WGSL: fn Cell_value_ref_0(...) -> ptr<function, i32>`

**Why it slips through:** `docs/generated/tests/_meta/expected-failures.txt` tracked only the base `refaccessor-property.slang.1/.2` (the Metal-abort + SPIR-V-invalid-return facets the PR *fixes*), NOT the `-glsl`/`-wgsl` variants. So the new green suite the fixer ran cleared none of it — the generated suite runs separately (regenerated per the design-doc workflow, e.g. #12476).

**Reviewer discipline:** for any emit-behavior change, grep `docs/generated/tests/**` for the affected symbol/pattern and cross-check `expected-failures.txt`. Fix = regenerate the generated tests OR add expected-failures entries referencing the PR. This is a recurring, verifiable-cheaply gap that all three reviewers (correctness A / Devin B / clarity C) can miss unless one explicitly checks the committed generated tree.
