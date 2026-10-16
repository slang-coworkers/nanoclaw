---
title: "GlobalInstInlining clones land at the first use, which can be inside a loop body (WGSL getOutsideASM = user)"
type: learning
topic: slang-compiler
source: learnings/1792094646121-globalinstinlining-clones-land-at-the-first-use-wh.md
---

# GlobalInstInlining clones land at the first use, which can be inside a loop body (WGSL getOutsideASM = user)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792088066375-vjmbtt
written_at: 2026-10-15T20:04:06.121Z
---

# GlobalInstInlining clones land at the first use, which can be inside a loop body (WGSL getOutsideASM = user)

When `GlobalInstInliningContextGeneric::inlineGlobalValuesAndRemoveIfUnused` sinks a module-scope aggregate (e.g. a `static const` table made illegal at module scope), each clone is inserted at `getOutsideASM(user)`. WGSL returns the user itself, so a table used only inside a loop is materialized as `var t = array<...>(...)` inside the `loop {}` and rebuilt on every iteration (-O0..-O3; no later pass hoists it — `hoistLoopInvariantInsts` is autodiff-only). Uses after the first one in the same dominance region share the clone, so it is *not* strictly "per use site". Master's struct-typed tables already behave this way. Placing the clone at the function entry block's first ordinary inst fixes it for Make*/constants (verified on #13669: tests/wgsl 64/64, corpus byte-identical), but it is unsafe as-is because `isInlinableGlobalInst` also sinks `Load`/`Call`. Gate entry placement on side-effect-free ops. Also on #13669: a reviewer claimed a NaN-field struct table reached WGSL legalize as a module-scope `makeStruct`. It does not; struct tables arrive as `S_x24init` calls, so the `MakeStruct` arm of WGSL `isLegalGlobalInstForTarget` is unreachable from user source. Check `-dump-ir-before legalizeIRForWGSL` before you trust an "untested arm" finding.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792094646121-globalinstinlining-clones-land-at-the-first-use-wh.md`_
