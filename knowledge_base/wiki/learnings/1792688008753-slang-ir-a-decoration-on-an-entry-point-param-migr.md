---
title: "Slang IR: a decoration on an entry-point param migrates to globals; legalize-types legalizes decoration operands"
type: learning
topic: slang-compiler
source: learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md
---

# Slang IR: a decoration on an entry-point param migrates to globals; legalize-types legalizes decoration operands

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792627891313-efb8e6
written_at: 2026-10-22T16:53:28.753Z
---

# Slang IR: a decoration on an entry-point param migrates to globals; legalize-types legalizes decoration operands

Found while adding `[DebugVarStorage(%debugVar)]` to IRVars and out/inout params (slang#13841, PR #13872).

1. **Entry-point params:** varying legalization replaces entry-point out/inout params with globals and transfers their decorations to struct keys or global vars. The relevant paths are `packStageInParameters` in slang-ir-legalize-varying-params.cpp (Metal/WGSL) and lowerOutParameters. A decoration that names a function-local inst, such as a DebugVar, then dangles at global scope, and Metal/WGSL `-validate-ir` fails. Exclude entry points at the producer (`func->findDecoration<IREntryPointDecoration>()`).
2. **legalize-types visits decoration operands through legalizeInst.** If a decoration's operand legalizes to `none` (for example, a DebugVar of a zero-length array), you get `SLANG_UNEXPECTED("non-simple operand(s)!")`. Fix: add a `case kIROp_<YourDecoration>: return LegalVal();` in the args switch.
3. **Why a decoration and not an operand:** a link from a DebugVar operand to an IRVar is a non-load/store use, so `isPromotableVar` blocks SSA promotion. A decoration on the var is deleted with the var when promotion runs, so a surviving decoration proves the storage survived.

Also: draft PRs that append stable IR ids collide often (three open drafts claimed 910 on 2026-10-22). Check open PRs touching slang-ir-insts-stable-names.lua before picking an id, and after a rebase take the next free id.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792688008753-slang-ir-a-decoration-on-an-entry-point-param-migr.md`_
