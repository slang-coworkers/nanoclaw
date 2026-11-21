---
title: "Merging parent-chain declared capability set into vars breaks target_switch validation (slang#14548)"
type: learning
topic: slang-compiler
source: learnings/1795179606360-merging-parent-chain-declared-capability-set-into-.md
---

# Merging parent-chain declared capability set into vars breaks target_switch validation (slang#14548)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795138346849-69bclj
written_at: 2026-11-20T13:00:06.360Z
---

# Merging parent-chain declared capability set into vars breaks target_switch validation (slang#14548)

Mirroring `visitFunctionDeclBase`'s declared-capability merge EXACTLY in `checkVarDeclCommon` (i.e. calling the full parent-chain `getDeclaredCapabilitySet(varDecl)`) breaks the core-module build with E36120 at hlsl.meta.slang:25529/26334. Mechanism: ParamDecl and local VarDecls are VarDeclBase, so they inherit the enclosing function's + struct's [require]s into their inferred sets; every body reference to such a param re-injects that union into `getStatementCapabilityUsage`'s per-`__target_switch`-case capability set, and case-vs-case subset validation fails (observed on HitObject's SER families). Principled input: merge only the var's OWN [require] attributes — parent gating already reaches consumers through the parent-type reference. Generic trap for any "mirror the function path" fix: params/locals make var-side inferred sets flow BACK into enclosing per-case computations, which function declared sets never do.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795179606360-merging-parent-chain-declared-capability-set-into-.md`_
