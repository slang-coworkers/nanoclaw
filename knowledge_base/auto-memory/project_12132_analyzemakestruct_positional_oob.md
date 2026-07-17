---
name: project_12132_analyzemakestruct_positional_oob
description: "#12132 analyzeMakeStruct positional OOB — triaged P3 latent; held for jkwak maintainer assert-vs-tolerate call"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8c8f89b4-22ed-4cbd-b58e-b967f308fa4d
---

# #12132 — analyzeMakeStruct indexes IRMakeStruct operands positionally without bounds check

Coworker-filed (nv-slang-bot), spun out of #9580 investigation as an INDEPENDENT IR-robustness issue. NOT the cause of #9580 (front-end type⇔layout desync, fixed separately). Also appeared in contributor PR #10030.

**Bug:** `source/slang/slang-ir-typeflow-specialize.cpp` `analyzeMakeStruct` (~L2260-2283) loops over `structType->getFields()` but reads `makeStruct->getOperand(operandIndex)` (L2263) with `operandIndex` bounded by FIELD count, never checked vs `getOperandCount()`. Under-supplied MakeStruct → debug abort / release OOB read.

**Triage verdict (slang-triager, verified @HEAD 1cfc8ec51):** Bug / low sev / P3 / IR typeflow-specialization. LATENT — no reproducer. Every legitimate under-supply path preserves operand==field parity (DCE trimMakeStructOperands trims field+operand in lockstep; varying-params builds fresh 1-field/1-op struct; autodiff translateMakeStruct guards identical pattern w/ `SLANG_RELEASE_ASSERT(ii < origMakeStruct->getOperandCount())` at `slang-ir-autodiff-fwd.cpp:907`). No short-list producer found.

**Recommended fix — Approach A:** assert invariant at consumption (`SLANG_RELEASE_ASSERT(makeStruct->getOperandCount() == fieldCount)` before loop). Matches repo "fail loudly on out-of-contract input" + autodiff precedent; zero regression. Approach B (min-bound loop) rejected — masks producer bug. Approach C (fix producer) N/A — no producer found.

**State (07-16):** Triage verdict POSTED to GitHub (comment 4987735917, 5-bullet). Assignee = **jkwak-work** (human-set). HELD for maintainer: issue + triager both defer to maintainer to confirm no legitimate short-list producer exists before choosing assert-vs-tolerate. NO fix dispatched — one-line assert but design call is jkwak's. Stand down per self-assigned-maintainer rule. Re-open if jkwak comments or a substantive human reply lands.

Thread: gh-issue-shader-slang/slang-12132. See [[project_9580]] (not stored) — front-end fix separate.
