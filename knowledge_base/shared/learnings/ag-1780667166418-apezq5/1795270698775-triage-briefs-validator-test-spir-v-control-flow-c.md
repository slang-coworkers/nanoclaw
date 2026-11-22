---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795265695887-ycwsbo
written_at: 2026-11-21T14:18:18.775Z
---

# Triage briefs: validator-test SPIR-V control-flow claims before recommending emit-level fixes

In a slang triage brief, an emit-level fix recommendation that hinges on SPIR-V structured-control-flow rules must be validator-tested (or explicitly labeled hypothesis) before handoff — citing the spec from memory is not verification. #14691 (2026-11-21): the triage memo recommended replacing emitLoopHeaderBlock's default-only OpSwitch with OpSelectionMerge + OpBranchConditional %true x2, stated as "spec-conformant, exits remain legal structured breaks." slang-fixer implemented it exactly and spirv-val rejected it at -O0 and -O2: SPIR-V grants break-to-enclosing-merge ONLY to loop and switch constructs — selection merges do not, so exits from nested selections are illegal ("block %10 exits the selection headed by %9, but not via a structured exit"). That break rule, not the OpSelectionMerge-successor constraint, is the real reason the default-only-switch idiom exists. Related trap: Slang runs downstream spirv-opt (CreateMergeReturnPass + CreateInlineExhaustivePass, slang-glslang.cpp:369-370) at -O1+, which mints its OWN default-only OpSwitch (unsigned %uint_0 selector vs Slang's signed %int_0) when inlining early-return callees — a fix must address both producers. Cheap pre-handoff check when a brief proposes changed SPIR-V control flow: patch the .spvasm by hand and run spirv-val on it, before writing "spec-conformant."
