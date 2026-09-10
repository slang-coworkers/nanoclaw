---
title: "[approver/challenger-probe] Language-reference conversion-doc PRs: verify each warn/allow classification against the compiler's conversion cost (E30081 threshold), and separate current-vs-planned cells"
type: learning
topic: review-approval
source: learnings/1788960523826-approver-challenger-probe-language-reference-conve.md
---

# [approver/challenger-probe] Language-reference conversion-doc PRs: verify each warn/allow classification against the compiler's conversion cost (E30081 threshold), and separate current-vs-planned cells

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788776931144-xkbtcg
written_at: 2026-09-09T13:28:43.826Z
---

# [approver/challenger-probe] Language-reference conversion-doc PRs: verify each warn/allow classification against the compiler's conversion cost (E30081 threshold), and separate current-vs-planned cells

## Context
shader-slang/slang#12039 R4 (@262958bbabc6) was the FIRST *substantive* evaluation
of the PR: once the policy mount was restored (v0-shadow-wide-r2, 2026-09-09), the
fork-head + oversize clause-abstains of R1–R3 no longer fired and all 6 clauses
passed, so the challenger actually ran. The PR documents Slang's implicit-conversion
"allowed vs. allowed-but-diagnosed (warning)" table — a reference page whose whole
purpose is that the table is accurate.

## The probe (transferable to any conversion/diagnostic-doc PR)
A documented "this conversion is allowed (no warning)" vs "this conversion warns"
classification is a CLAIM ABOUT COMPILER BEHAVIOR. Verify it against the source, not
the prose:
- In Slang, an implicit conversion emits `E30081 unrecommended-implicit-conversion`
  when its `ConversionCost` is >= the default threshold (logic in
  `slang-check-conversion.cpp` `_coerce`). So the doc's warn/allow split must match
  the per-conversion `kConversionCost_*` values.
- Concrete discrepancy found here: the doc lists `bool → integer type` among the
  ALLOWED (undiagnosed) conversions, but `kConversionCost_BoolToInt = 120`, which is
  >= the E30081 threshold — i.e. bool→int may actually WARN, contradicting the doc.
  (Left unverified/OPEN_GAP: deepwiki hedged and its cited test was bool→float, and a
  stale source-reading production review had vouched the lists accurate.)
- Second class of trap: the doc used an "after GitHub issue #NNNNN = intended/planned
  behavior" convention for cells. deepwiki indicated the int→float "literal with no
  precision loss" suppression is ALREADY active, while the cell marked it planned
  (#12929). Always separate "documents current behavior" from "documents a tracked
  future change" — a planned-behavior cell that already matches current behavior (or
  vice-versa) is a real doc-accuracy gap, not a nit.

## How to catch / decide
- On the fallback tier (Devin-only), Devin's "the docs are factually wrong" claims on
  conversion tables are usually misreadings (its concrete ones here — ":161 matrix
  conversions disappear", ":84-88 empty stubs" — were rendering artifacts). But do NOT
  dismiss the *whole class*: read the diff and spot-check the warn/allow cells against
  `kConversionCost_*` / the E-code that fires. That converted a batch of low-confidence
  Devin noise into ONE credible, checkable doc-accuracy question.
- If you can't conclusively confirm the table at the pinned head (fallback tier, only a
  stale source-reading review), that is an OPEN_GAP → ABSTAIN for human verification;
  uncertainty never rounds up to WOULD_APPROVE. Not BLOCK unless you actually verify the
  cell is wrong (a 🔴).

## Meta-lesson
The SAME PR flipped from deterministic clause-abstain (R1–R3, bundled v0-shadow) to a
substantive challenger OPEN_GAP (R4, mounted wide policy) purely because the policy
changed. Always re-derive from the mounted policy each revision; a prior revision's
"abstained on clauses, never looked at content" tells you nothing about the content.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788960523826-approver-challenger-probe-language-reference-conve.md`_
