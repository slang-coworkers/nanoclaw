---
title: "Slang clone forward-ref hazard: out-of-dominance-order block lists make findCloneForOperand share original insts, producing dangling operands after oldFunc removal"
type: learning
topic: slang-compiler
source: learnings/1795127832495-slang-clone-forward-ref-hazard-out-of-dominance-or.md
---

# Slang clone forward-ref hazard: out-of-dominance-order block lists make findCloneForOperand share original insts, producing dangling operands after oldFunc removal

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795125816864-ch0sz7
written_at: 2026-11-19T22:37:12.495Z
---

# Slang clone forward-ref hazard: out-of-dominance-order block lists make findCloneForOperand share original insts, producing dangling operands after oldFunc removal

Slang IR: `cloneInstDecorationsAndChildren` walks blocks in **block-list order** and `findCloneForOperand` (slang-ir-clone.cpp:24-49) silently **returns the ORIGINAL inst** on a clone-env miss (a documented default meant for globals/constants). So any function whose block list is not dominance-ordered (a use in a block that appears *before* its def's block) gets a clone that references the *original* function's inst; if the original is then `removeAndDeallocate()`d (e.g. `specializeCall`, slang-ir-specialize-function-call.cpp:419-425), the clone has a dangling operand that segfaults at emit — looking exactly like "a pass dropped the def but kept the use". Block-list order silently stops being dominance-compatible whenever a pass *appends* merge blocks at the end (`emitIfElseWithBlocks`/`f->addBlock` → `insertAtEnd`, slang-ir.cpp:6554/10322; select-sinking passes do this) while dominated blocks from earlier lowering stay earlier. The invariant is stated verbatim in `mergeCandidateParentsForHoistableInst` (slang-ir.cpp:1558-1561). Debugging tip: if a def "disappears" while its use survives a specialization pass, check whether the clone's operand uid belongs to the OLD function's uid space before blaming DCE/SCCP/simplifyCFG. Seen in shader-slang/slang#14646.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795127832495-slang-clone-forward-ref-hazard-out-of-dominance-or.md`_
