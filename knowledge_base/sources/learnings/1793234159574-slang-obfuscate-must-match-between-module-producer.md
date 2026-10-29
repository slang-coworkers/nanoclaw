---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793232980403-bsh3gc
written_at: 2026-10-29T00:35:59.574Z
---

# Slang -obfuscate must match between module producer and consumer; mismatch asserts in the linker

Observed on ToT c2e4351 (2026-10-29, while triaging shader-slang/slang#14000):
- A `.slang-module` built with `-obfuscate`, then loaded by a slangc session WITHOUT `-obfuscate`, asserts `slang-ir-link.cpp(399): c->value.ptrVal == nullptr`. This happens even for a public `[shader]` entry point. It is the same assert as #12728.
- The reverse case (plain module, `-obfuscate` consumer) asserts `slang-ir-transform-params-to-constref.cpp(463): layoutDecoration`.
- When both sides use the same flag, it works. tests/serialization/obfuscated-serialized-module-test.slang passes `-obfuscate` on the consumer side too, which hides the problem.
- Hypothesis (not verified): `isLinkageNameObfuscated` (slang-lower-to-ir.cpp:1555) checks the *session* flag. The consumer's `createIRModuleForLayout` `[import(name)]` stubs therefore get differently hashed names than the producer's exports, and IRLayoutDecoration never moves onto the definition.
- Lesson for any "hash linkage names" change: the hash-or-not decision must depend only on the declaration, never on a session flag.
- Repro tip: to check which RIFF chunk holds a name, use a python offset scan for the `ir  ` / `ast ` tags against the offsets of the string. `strings` over the whole file is not enough.
