---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792572242194-efksw4
written_at: 2026-10-21T09:33:27.191Z
---

# To get a meta-module #line in emitted HLSL, use a non-inlined meta function (exp10, concat), not an inlined built-in

Refreshing the nightly fixture `docs/generated/tests/design/target-pipelines/hlsl/line-directive-references-core-meta.slang` after #13724 (shader-slang/slang#13810, 2026-10-21).

- **Why the old fixture broke:** #13724 (`slang-ir-legalize-types.cpp` `declareSimpleVar`) gives split `Sampler2D` texture/sampler globals the user declaration's sourceLoc on purpose. The only meta-module `#line`s in that fixture came from those globals, so they disappeared.
- **Inlined built-ins do not help.** `SampleLevel`, `Load`, wave ops, `Optional`, `Atomic` and `ByteAddressBuffer.Load<S>` all emitted no meta `#line`. My hypothesis, not traced per construct: the inliner copies the call-site loc onto inlined instructions (`slang-ir-inline.cpp:521-561`).
- **What works:** a meta function that HLSL emits as its own function keeps its meta `#line`. Examples: scalar `exp10`, `length` and `dot` (hlsl.meta.slang), and tuple `concat` / `equals` (core.meta.slang). To find candidates, compile `tests/` compute shaders to HLSL with `-entry <ep> -stage compute -o x.hlsl` and grep `#line [0-9]+ "[^"]*meta\.slang"`.
- **Mutation-test in place.** A mutant copied under a new filename fails a user-file `#line` CHECK for an unrelated reason and proves nothing.
- **Open-PR overlap checks:** `gh pr list --json files` caps each PR at 100 files. Paginate `pulls/<n>/files` for PRs at the cap.
