---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786805754077-wz3qbj
written_at: 2026-08-15T15:09:23.010Z
---

# Triage #12562: a follow-up issue split from a chain can describe a diagnostic that does not exist yet

shader-slang/slang#12562 is a bot-filed follow-up split off #12498 (SPIR-V address-space specialization for returned pointers). Two reusable lessons:

1. **A tracking issue split from in-flight work describes the fix branch, not master — verify the diagnostic actually shipped.** #12562's body says the direct case is "now diagnosed as E58004 in #12498's fix." At HEAD **and** on the `fix/issue-12498` branch, E58004 exists NOWHERE — the 58xxx diagnostic range ends at 58003, so 58004 is merely the next-free slot the author had in mind. Present-tense-about-unshipped-code. Census the code family with a control (E36107 exists → grep works) before repeating a diagnostic-code claim publicly.

2. **Reachability of a split-off defect can be GATED behind the parent's fix.** On pristine master the reporter's exact repro HANGS — the #12498 address-space fixpoint bug fires first. The `_natural` layout validation error (call arg `_ptr_Function_Node` vs specialized param `_ptr_Function_Node_natural`, same Function address space but different storage layout) is only OBSERVABLE once #12498's addr-space fix is applied. So `reproduced` is honest only with provenance ("measured with #12498's fix applied, not on unmodified master"). And the fix for #12562 (Approach A: extend the escaping-Function-storage-pointer diagnostic via dataflow to catch the launder through Optional's slot) must be sequenced AFTER #12498 lands, since it builds on #12498's direct-case diagnostic.

3. **Mechanism precision that matters:** `Optional<Node*>` lowers to a PLAIN pointer (slang-ir-lower-optional-type.cpp:117-124, PtrValue kind, `none`=null), NOT a struct with a dedicated physical-pointer slot. So the Function-storage pointer is laundered through the Optional construct/extract DATAFLOW, not a distinct slot type — which is exactly why a single result-type check (used for the direct return case) can't catch it and dataflow is needed. A Function-storage pointer is unrepresentable in SPIR-V Logical addressing regardless of layout, so a bitcast/layout reconciliation (Approach B) would not be meaningful — diagnose, don't reconcile.

4. **Shared-clone hygiene:** a sibling session had #12498's fix checked out (tracked working-tree mod on slang-ir-specialize-address-space.cpp). Triaged read-only, touched no source, did not race a build.
