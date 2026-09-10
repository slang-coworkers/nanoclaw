---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788776931144-xkbtcg
written_at: 2026-09-09T14:51:36.996Z
---

# [approver/false-safe] Near-miss caught by the DECISION_REVIEW gate: verify a warn/allow-table finding by COMPILING, not by cost-inference/deepwiki — and record the decision AFTER critique

## Symptom
On shader-slang/slang#12039 R5 (docs PR, language-reference conversion table), I was
about to record **WOULD_APPROVE**. I had convinced myself Devin's finding ":252
boolean integer warnings omitted" was noise: I "verified" via deepwiki in R4 that
`kConversionCost_BoolToInt = 120` and (wrongly) that 120 ≥ the warning threshold, then
in R5 flipped to reading it as harmless. The `/codex-critique` DECISION_REVIEW gate
returned **must-fix**: codex actually COMPILED (`slangc -no-codegen`) and showed the
finding is REAL — the threshold `kConversionCost_Default = 500`; `bool→int` (cost 120)
is allowed, but nonconstant `bool→intptr_t` falls through to cost 900 (≥ 500) and emits
`warning[E30081]`. So the doc's blanket "bool to an integer type = allowed" is
inaccurate for `intptr_t`. Decision corrected to ABSTAIN_POLICY/OPEN_GAP.

## Root cause
1. **deepwiki gave wrong exact numbers** (it implied cost 120 ≥ the threshold; the real
   threshold is 500, and its cited "test" was bool→FLOAT, not bool→int). I used that
   unreliable inference to both RAISE (R4) and then try to CLEAR (R5) a doc-accuracy
   finding. LLM-summarized cost/threshold constants are not trustworthy for a decision.
2. **I tried to override a reviewer "Bug"/finding to APPROVE without empirical proof.**
   On a warn/allow classification, "it probably doesn't warn" is a claim about compiler
   behavior — it must be COMPILED, not reasoned.
3. **I recorded the decision before critique finished**, so the append-only ledger's
   first challenger entry kept over-broad wording that later rounds narrowed.

## How to catch / fix
- To clear (or confirm) a finding that a documented conversion is/ isn't diagnosed,
  COMPILE a minimal repro with the actual `slangc` (each target type), or read the exact
  `kConversionCost_*` constants + the `_coerce` threshold (`slang-check-conversion.cpp`)
  — never rely on deepwiki's numeric claims. The threshold is
  `kConversionCost_Default = 500`; `bool→int` is the cost-120 `BaseType::Int` special
  case; other bool→integer (uint, fixed-width int/uint {8..64}, uintptr_t) are <500
  (allowed); nonconstant `bool→intptr_t` is 900 (warns E30081).
- NEVER round a reviewer/Devin finding down to WOULD_APPROVE on inference alone; if you
  can't empirically disprove it and clauses otherwise pass, ABSTAIN (OPEN_GAP). "Every
  judgment call resolving toward approve" is the tell to distrust — it fired here.
- Sequence: run the FULL critique gate (DECISION_REVIEW → OUTPUT_REVIEW) and reach
  approve BEFORE calling `record_decision`. record_decision is append-only/first-write-
  wins, so recording early freezes pre-critique wording into the ledger.
- The critique gate is doing exactly its job for WOULD_APPROVE/BLOCK: it converted a
  would-be false-safe into a correct abstain. Treat a DECISION_REVIEW must-fix as a
  strong signal you were rationalizing.

## Meta
Across R1–R5 the abstain outcome was substantively correct the whole time; R4's
OPEN_GAP (though deepwiki-justified) pointed at a real (narrow) gap, and R5's attempt to
clear it was the error the gate stopped. The durable probe: verify conversion-doc
warn/allow cells by compiling, per target type.
