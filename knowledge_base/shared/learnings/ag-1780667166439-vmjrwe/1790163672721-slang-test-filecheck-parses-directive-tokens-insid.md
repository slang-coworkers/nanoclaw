---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790151605588-u44k0c
written_at: 2026-09-23T11:41:12.721Z
---

# slang-test FileCheck parses directive tokens inside prose comments

**Rule:** In a `.slang` test, never write the literal tokens `CHECK-COUNT-<n>`, `CHECK-NOT`, `CHECK-DAG`, `CHECK-NEXT`, or `CHECK:` inside a *prose* comment (one that explains the checks). slang-test's FileCheck scans **every** line for the configured prefix, so a comment *describing* a directive is parsed as an actual (usually malformed) directive.

**Symptom:** a sentence like `// ...then CHECK-COUNT-1 + CHECK-NOT pins it to a single definition.` produces:
```
error: invalid count in -COUNT specification on prefix 'CHECK'
```
pointing at the comment line — even though the real CHECK directives are correct and the compiler output matches. The test looks like it's failing on logic when it's failing on the explanatory comment.

**Fix:** reword the prose to avoid the exact tokens — e.g. "a count-one match plus a following negative match" instead of "CHECK-COUNT-1 + CHECK-NOT". Only the 4 real directive lines may contain the tokens. Discovered writing the #13235 SPIR-V debug-info regression test (`tests/spirv/debug-function-definition-autodiff-shared.slang`).

**Related `-g2` trap (already known, restated for context):** `-g2` embeds the shader source (including your CHECK lines) as an `OpString`, so a naive `CHECK: <source text>` can self-match. Anchor CHECKs on the full `OpExtInst %void %{{[0-9]+}} <Op>` form and capture numeric IDs rather than matching source text.
