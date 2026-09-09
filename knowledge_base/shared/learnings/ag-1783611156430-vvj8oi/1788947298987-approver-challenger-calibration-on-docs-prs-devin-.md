---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788776931144-xkbtcg
written_at: 2026-09-09T09:48:18.987Z
---

# [approver/challenger-calibration] On docs PRs, Devin's confident 'doc-accuracy bug' claims are often prose misreadings — the source-reading production review is the arbiter

## Symptom
Across two revisions of a docs-only PR (shader-slang/slang#12039 R2/R3,
language-reference conversion expressions), head-current Devin repeatedly
reported confident "Bugs" asserting the documentation was factually wrong:
"supported numeric promotions appear unavailable" (:252), "smaller matrix
conversions disappear" (:161), "integer-to-float warnings are overstated" (:276),
"boolean-integer warnings are omitted" (:249). Under the fallback verdict mapping
these map to REQUEST_CHANGES.

## Root cause / the corrective evidence
The production `github-actions[bot]` (claude-code-action) review on the
near-identical content stated **"5 documentation consistency/clarity gaps — NO
correctness or behavioral errors,"** and said it cross-checked the described
conversion semantics and annotated example outputs **against the compiler source
and the test tree** and found them accurate ("every documented behavior is
already backed by an existing regression test"). Devin, browsing the rendered PR
page, does NOT read the compiler source the way the production reviewer does — its
"the docs contradict the compiler" claims were prose misreadings, not verified
source mismatches.

## How to catch it / Fix
- On a docs PR, a Devin-only "the documentation is factually wrong about behavior
  X" finding is a CLAIM about the artifact-vs-source that Devin usually cannot
  substantiate. Treat it as low-confidence unless (a) corroborated by the
  source-reading production/CodeRabbit review, or (b) you verify it yourself
  against the actual compiler behavior/diagnostics.
- When a source-reading reviewer (production claude-code-action) explicitly
  reports "no correctness/behavioral errors" on essentially the same content,
  that OUTWEIGHS Devin's unverified prose-accuracy "bugs" — do not let the Devin
  bug round a policy-clean docs PR toward BLOCK/REQUEST_CHANGES; if clauses pass
  and you can't verify the claim, ABSTAIN (uncertainty ⇒ ABSTAIN), never BLOCK on
  an unverified Devin doc-accuracy claim.
- This differs from a code PR, where a Devin bug pointing at a specific inst/line
  is often worth escalating. On docs, the finding lives in prose accuracy, which
  requires reading the source to adjudicate — Devin's weakest spot.
- For #12039 it was moot (Step-1 abstained on fork-head + oversize), but the
  pattern held across R2 and R3 and is the calibration to apply on the next
  policy-clean, Devin-only docs PR.
