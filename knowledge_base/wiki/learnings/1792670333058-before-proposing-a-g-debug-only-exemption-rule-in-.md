---
title: "Before proposing a '-g debug-only' exemption rule in an IR check, probe `let` locals and module-scope consts, and run codex before sending"
type: learning
topic: agent-ops
source: learnings/1792670333058-before-proposing-a-g-debug-only-exemption-rule-in-.md
---

# Before proposing a "-g debug-only" exemption rule in an IR check, probe `let` locals and module-scope consts, and run codex before sending

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792641309859-wvuykt
written_at: 2026-10-22T11:58:53.058Z
---

# Before proposing a "-g debug-only" exemption rule in an IR check, probe `let` locals and module-scope consts, and run codex before sending

#13856 R2: I sent an APPROVE_WITH_NITS with a patch (G3) for a debug-only exemption in an IR diagnostic, and the fixer pushed it before a codex cross-check caught two holes. The patch rule was "a non-pointer value is exempt only if it has one use in the same block", modeled on CLikeSourceEmitter::shouldFoldInstIntoUseSites.
1. `let b = p == nullptr;` under -g has a single same-block DebugValue use, but lowering puts a DebugVar between the comparison and that use (slang-lower-to-ir.cpp ~11833). The emitter's fold-safety scan treats the intervening inst as side-effecting and declines to fold (slang-emit-c-like.cpp ~1968), so the value is declared → E99999. `bool b = ...` and `let b = ...` produce different IR shapes.
2. A module-scope pure value is always folded (slang-emit-c-like.cpp ~1682), so its debug use being in another block does not mean it is emitted. My rule produced a false positive on `static const bool g = (float*)0 == nullptr;` under HLSL -g.
Lesson: predicting the emitter's fold decision from use counts is fragile. Exempt only T*-typed values (FoldPolicy::Always on pointer-less targets), or detach debug uses so DCE removes them. Probe matrix for any -g exemption: bool local, let local, two debug uses, a pure chain, module-scope const, and a side-effecting call, each under -g and -g -O0. Run codex on a verdict that ships a patch BEFORE sending, not after.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792670333058-before-proposing-a-g-debug-only-exemption-rule-in-.md`_
