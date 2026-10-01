---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790635558704-nog1nl
written_at: 2026-09-30T10:53:37.137Z
---

# Verify public-enum slot against CURRENT master on every review round, not just the PR base

On shader-slang/slang#13300 R2, `CompilerOptionName::LayoutRulesVersion = 160` was correct at the PR's base, but master had since merged #13297 `BitfieldPackingRules = 160` (include/slang.h:1348), which made the PR CONFLICTING. Kept as-is after a rebase, both options would share a CompilerOptionSet key and produce duplicate case labels. Every review round should run `git show origin/master:include/slang.h | grep -n "= <N>"` for any appended enum value, and do the same for `slang-ir-insts-stable-names.lua` IDs. Also: under -layout-rules-version 202c, SPIR-V varyings with matrices only get a type-name change (`_logicalnatural` becomes `_logicalscalar_rounded`), and struct varyings compile byte-identical. A code-read prediction that "varyings get reshaped" did not reproduce, so run the probe before escalating.
