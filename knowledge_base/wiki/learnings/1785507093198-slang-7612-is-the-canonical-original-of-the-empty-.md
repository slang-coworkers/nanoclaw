---
title: "slang#7612 is the canonical original of the empty-CUDA-struct dup pair (#8125 is the slangpy instance)"
type: learning
topic: slang-compiler
source: learnings/1785507093198-slang-7612-is-the-canonical-original-of-the-empty-.md
---

# slang#7612 is the canonical original of the empty-CUDA-struct dup pair (#8125 is the slangpy instance)

When triaging shader-slang/slang#7612 ("Properly handle empty CUDA structs", opened 2025-07-02 by sricker-nvidia), the correct verdict is DEDUP, not fresh-fix:

- **#7612 is the ORIGINAL/canonical** empty-CUDA-struct bug. **#8125** ("Empty structs handled incorrectly in CUDA → slangpy crashes", opened 2025-08-08) is the **slangpy-surfaced instance of the exact same root cause**. Maintainer @bmillsNV explicitly commented on #8125: "Looks like a dup of #7612." #7612's timeline cross-references #8125.
- **The active fix is on #8125, NOT #7612**: draft PR #12304 (`Fixes #8125`, jkwak-work's dictated minimal fix — remove the `addPublicDecoration` block in `addLinkageDecoration`, slang-lower-to-ir.cpp:1434-1438, + mechanical `else if`→`if`). #12304's closingIssuesReferences lists only #8125.
- **Do NOT dispatch slang-fixer for #7612** — it would double-implement the identical change already in PR #12304. Route #7612 as a dup; a maintainer should add `Fixes #7612` to #12304 or close #7612 as dup at merge (never auto-close).
- **Fix home is Slang codegen, not slangpy** (the reporter's leading hypothesis was a slangpy stride/alignment calc in shader_cursor.cpp — disproven). Reflection/type-layout correctly treats the empty struct as size 0; the **Slang C-like emitter** (slang-emit-c-like.cpp:4477, only skips IRVoidType) fails to omit the zero-size empty-struct field, so the emitted CUDA/CPU struct places the next field 1 byte off (`sizeof(empty)==1`). slangpy binds per reflection (offset 0), device reads per emit (offset 8) → CUDA_ERROR_ILLEGAL_ADDRESS. Trigger is a `public`/exported empty struct, which `IREmptyTypeLegalizationContext::isSimpleType` retains (slang-ir-legalize-types.cpp:4104,:4117) while a non-public one legalizes to void and drops.
- Reproduced at master HEAD c3791ed4e this session (static emit/offset mismatch). Exhaustive root-cause trace lives in triage-8125.md.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785507093198-slang-7612-is-the-canonical-original-of-the-empty-.md`_
