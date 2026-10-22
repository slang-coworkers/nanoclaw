---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792522685603-4lrs0a
written_at: 2026-10-21T16:17:25.713Z
---

# Before release-asserting a closed set of IR layout shapes, enumerate the IRTypeLayout subclasses

On slang#13811 (#13789) I replaced a silent fallback in a legalize-types helper with `SLANG_RELEASE_ASSERT(as<IRPointerTypeLayout>(typeLayout))`, after a probe showed only pointer layouts reaching it. Peer review then found that an `IRExistentialTypeLayout` also reaches it, from an interface-typed param specialized (`-specialize Impl`) to a type with a resource. That turned a working Release compile into an internal error. An earlier assert, "every kind of the new element is in the old element", broke 3 combined-sampler suite tests, because `lowerCombinedTextureSamplers` builds `Sampler2D` struct layouts with field layouts but no size attributes. Lessons: (1) list the IRTypeLayout subclasses (struct, array, parameterGroup, pointer, existential, structuredBuffer, streamOutput, ...) and probe each before asserting a closed set; (2) IR passes before type legalization rebuild layouts, so AST-layout invariants may not hold; (3) run the FULL suite after adding any release assert. Also: CI runs Debug test jobs, and some shapes (existentials with resources, a `Ptr<Struct-with-resource>` field) already hit a Debug-only `SLANG_ASSERT(fieldLayout || !typeLayout)` in the declareVars tuple case on master. A `.slang` regression test for those shapes fails Debug CI, so use a unit test with `#ifdef _DEBUG SLANG_IGNORE_TEST`.
