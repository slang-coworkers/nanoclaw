---
title: "CHECK-NOT paren vacuity, reviewer mechanism claims, precise CSE, and the ### Verdict heading — four traps from slang PR #14599"
type: learning
topic: review-process
source: learnings/1795030888933-check-not-paren-vacuity-reviewer-mechanism-claims-.md
---

# CHECK-NOT paren vacuity, reviewer mechanism claims, precise CSE, and the ### Verdict heading — four traps from slang PR #14599

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795015012013-jbyh7p
written_at: 2026-11-18T19:41:28.933Z
---

# CHECK-NOT paren vacuity, reviewer mechanism claims, precise CSE, and the ### Verdict heading — four traps from slang PR #14599

Three traps from slang#14591 PR #14599 (rounds 2-3, 2026-11-18):

1. `mod(abs(m_0)` as a FileCheck CHECK-NOT pattern is VACUOUS: the `)` closes `abs(`, not `mod(`. The buggy whole-matrix spelling `mod(abs(m_0), abs(...))` has a comma after `m_0`, the valid row spelling `mod(abs(m_0[0])` a bracket — so the pattern matches neither, ever (a NOT that always passes, catching nothing). The discriminating pattern is `abs(m_0)` (closed): it matches the matrix in either mod argument of the buggy form and never the row spelling. Same for `sign(m_0)`.

2. A reviewer's file:line-cited mechanism claim can still be wrong — verify, don't propagate. Reviewer A's round-2 question asserted the gate clause `isSPIRV(target) && !shouldEmitSPIRVDirectly()` was dead because "via-GLSL reaches the linkAndOptimizeIR switch as GLSL after _getDefaultSourceForTarget remap" (citing slang-code-gen.cpp:274-275). FALSE: that switch keys on codeGenContext->getTargetFormat() (the REQUESTED target), so via-GLSL SPIR-V arrives as SPIRV/SPIRVAssembly with shouldEmitSPIRVDirectly()==false — the old clause was reachable. The remap only feeds downstream-compiler selection later. Writing the reviewer's rationale into a code comment got it flagged must-fix by codex. The true reason a single `!targetProgram->shouldEmitSPIRVDirectly()` check covers the whole GLSL family: the helper conjoins isSPIRV(target) with the emit-method option (slang-target-program.h:114-117).

3. A `precise` regression line must use a UNIQUE computation: `precise float2x2 p = m % n;` when `r = m % n` already exists gets CSE-merged into the non-precise value and the qualifier disappears from the emitted GLSL. Use `p = a % n;` (a value nothing else computes). Also: codex replies must carry the canonical `### Verdict` heading — a `## Verdict` (two hashes) reply records an empty verdict in workflow-state.json and the delivery gate then denies with "no verdict was recorded".

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795030888933-check-not-paren-vacuity-reviewer-mechanism-claims-.md`_
