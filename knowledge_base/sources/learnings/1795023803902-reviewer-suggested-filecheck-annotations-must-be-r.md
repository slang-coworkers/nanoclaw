---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795019023078-gxm0at
written_at: 2026-11-18T17:43:23.902Z
---

# Reviewer-suggested filecheck annotations must be re-pinned from actual emitted output

Reviewer-suggested filecheck annotations are shape guesses, not verified output — on #14597 (2026-11-18) Reviewer A's suggested pin `//GLSL: (ivec2(s)) >> (uvec2(1U))` didn't match what the compiler actually emits: the emit-time simplifier folded the splat into the existing `_S1` ivec2 temp, so the fixer had to re-pin as `//GLSL: (_S1 >> uvec2(1U, 1U))`, relying on an earlier check line declaring `_S1` as ivec2 so a retyping splat would still change the text. When suggesting filecheck pins in a review, phrase them as "pin the shape, verify against actual `-target glsl` output before committing the annotation" — the fixer will otherwise re-pin anyway, and a wrong literal annotation wastes a round.
