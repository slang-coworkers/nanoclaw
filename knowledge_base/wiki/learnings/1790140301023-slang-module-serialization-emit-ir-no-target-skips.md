---
title: ".slang-module serialization (-emit-ir, no -target) skips linkAndOptimizeIR entirely — emit-time checks never run"
type: learning
topic: slang-compiler
source: learnings/1790140301023-slang-module-serialization-emit-ir-no-target-skips.md
---

# .slang-module serialization (-emit-ir, no -target) skips linkAndOptimizeIR entirely — emit-time checks never run

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790122861041-y97g9i
written_at: 2026-09-23T05:11:41.023Z
---

# .slang-module serialization (-emit-ir, no -target) skips linkAndOptimizeIR entirely — emit-time checks never run

**Context:** Reviewer A finding on shader-slang/slang PR #13229 round 2 (static_assert as a decl), traced independently by 3 review passes; complements the earlier "HostVM early-return skips checkStaticAssert" learning.

`linkAndOptimizeIR` (`slang-emit.cpp`) — which hosts emit-time checks like `checkStaticAssert` / `checkAndRemoveStaticAsserts` — is invoked **only** through the per-target loop `for (auto targetReq : linkage->targets)`. When a module is compiled with `-emit-ir` / `ContainerFormat::SlangModule` and **no `-target`**, `linkage->targets` is empty, so `linkAndOptimizeIR` (and therefore *every* pass and diagnostic inside it) **never runs**; `maybeCreateContainer` then serializes the raw front-end IR (`module->getIRModule()`) verbatim into the `.slang-module`.

**Consequences / review takeaways:**
- A `[keepAlive]`+`[hlslExport]` synthesized inst (e.g. the static_assert carrier), chosen specifically to survive linking, gets serialized *unchecked* into the module. The failure is only enforced later, at the consumer's `import` + real-target codegen — a silent deferral, not a miscompilation.
- Any emit-time diagnostic/cleanup that is claimed to run "on every target" is inaccurate for the module-serialization path — it is a **non-codegen** path that bypasses `linkAndOptimizeIR`.
- When reviewing a feature that adds an emit-time check, ask whether a `.slang-module` round-trip (`slangc lib.slang -o lib.slang-module -emit-ir`) still exercises it; if the check lives in `linkAndOptimizeIR`, it does not.

**Adjacent fact confirmed same PR:** inserting a new *user-writable* `Decl` subclass requires BOTH (a) a `k_minSupportedModuleVersion`/`k_maxSupportedModuleVersion` bump (AST-node insertion shifts positional `ASTNodeType` serialization tags; precedent #13175/f3a7ce5b06), AND (b) classification in `classifyDeclForNesting` (`slang-check-decl.cpp`) — an unclassified new Decl silently takes the `Unknown` → "skip validation" path and bypasses the disallowed-by-default nesting table.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790140301023-slang-module-serialization-emit-ir-no-target-skips.md`_
