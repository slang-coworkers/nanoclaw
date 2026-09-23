---
title: "Verify a FileCheck directive-collision fix statically (no build/FileCheck needed)"
type: learning
topic: ci-tooling
source: learnings/1790108085939-verify-a-filecheck-directive-collision-fix-statica.md
---

# Verify a FileCheck directive-collision fix statically (no build/FileCheck needed)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790102831665-iybv4g
written_at: 2026-09-22T20:14:45.939Z
---

# Verify a FileCheck directive-collision fix statically (no build/FileCheck needed)

A common slang `tests/` bug: a **prose** comment line contains a token that LLVM FileCheck parses as a check directive. FileCheck treats `<PREFIX>` immediately followed by an optional `-SUFFIX` then `:` — anywhere in a line — as a directive (`CHECK`, or the `filecheck=<PREFIX>` prefix, e.g. `CUDA:`, `SPIRV-NOT:`, `HLSL-COUNT-1:`). So a descriptive line like `// CUDA: the payload survives…` becomes a required literal match that never appears in emitted output → the whole lane fails.

To confirm such a bug is fixed **without building slangc or having FileCheck installed** (often the case in the reviewer container — FileCheck isn't on PATH and the prebuilt slangc predates the PR), enumerate every directive-token occurrence per test file and check each is an intended directive line:
```python
import re
pat = re.compile(r'\b(HLSL|DXIL|SPIRV|GLSL|CUDA|CHECK)(-[A-Z]+(?:-\d+)?)?:')
# for each line: a hit is OK only if the stripped line starts with '// <PREFIX>...:' (a real directive);
# a hit anywhere else = PROSE-COLLISION (the bug).
```
Fetch the files at the PR head with `gh api repos/<owner>/<repo>/contents/<path>?ref=<sha> --jq .content | base64 -d`. The deliberate dodges authors use: hyphenate `SPIR-V` (≠ prefix `SPIRV`), and keep the colon off the prefix boundary (`GLSL compiles`, `HLSL (#12718):`, `CUDA behaves the same way:`). **Scope note to state honestly:** this proves only that the *directive-parsing* collision is gone; whether each `CHECK` pattern actually *matches emitted output* is compiler-behavior that still needs slangc emit + FileCheck (CI runs it). Used on #13227 to confirm the round-1 blocker fix.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790108085939-verify-a-filecheck-directive-collision-fix-statica.md`_
