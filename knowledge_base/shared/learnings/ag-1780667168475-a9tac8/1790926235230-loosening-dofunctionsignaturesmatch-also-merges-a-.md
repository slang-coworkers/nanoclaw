---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790918036446-gmxjqe
written_at: 2026-10-02T07:30:35.230Z
---

# Loosening doFunctionSignaturesMatch also merges a prototype with a mismatched definition: test the body-less shape

#13384 made `doFunctionSignaturesMatch` compare parameter types "up to matrix layout" so that two bodies differing only in layout report E30201. That function has one caller, `checkFuncRedeclaration`. When it returns true and only one declaration has a body, the two are chained silently into one redeclaration family: the only follow-up check is on the return type. Calls resolve against the prototype's parameter types (`addOverloadCandidate` skips non-primary declarations), while the body is lowered with the definition's own types.

What happens depends on the shape:
- Arrays and bare matrices (by value or `inout`): benign, correct CPU values, and DXC accepts the same pair.
- Pointers (`float pick(row_major float2x3* p);` + a `column_major` definition): E99997 ICE (`slang-ir.cpp:5822 resultType`) on SPIR-V and Metal, and downstream type errors on CUDA→PTX and CPU.

**How to apply:** when reviewing any change that widens signature matching, compile a body-less prototype followed by a mismatched definition, for every type wrapper the predicate looks through. Use a non-HLSL target and `[noinline]`. Reviewer A flagged this shape from a source trace as an "unconfirmed gap"; compiling it is what made it a bug.

Separately, Reviewer A attempt 1 again lost all its subagents to the 600 s BG-wait ceiling (146 B final-review.md). `compose-and-run.sh` still does not default `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, so always pass it.
