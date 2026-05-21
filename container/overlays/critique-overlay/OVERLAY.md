---
name: critique-overlay
license: MIT
type: overlay
description: "Stage-aware critique gates for any writer-style workflow. Spawns codex-critique at each gate for independent verification."
applies-to:
  workflows: []
  traits: [code.edit, test.gen, doc.write]
  start: false
insert-after: [diagnose, change, deliver]
insert-before: [change]
uses:
  skills: [codex-critique]
---

At each gate, invoke `/codex-critique` with what you did, why, and which files to check. Codex reads the code itself and returns approve or must-fix.

## DIAGNOSIS_REVIEW (after `diagnose`)

Send your synthesis: root-cause hypothesis, evidence gathered, approaches considered. Codex verifies the reasoning holds up against the codebase.

## PLAN_REVIEW (before `change`)

Send the plan from `{{report.path}}`: proposed changes, affected files, verification strategy. Codex checks coverage against the original spec and flags scope gaps.

## CODE_REVIEW (after `change`)

Send the diff (`git diff`) and your rationale. Codex verifies correctness, spec coverage, and test sufficiency.

## OUTPUT_REVIEW (after `deliver`)

Send the deliverable path. Codex checks completeness, factual accuracy, and silent omissions from the spec.

## Protocol

1. Invoke `/codex-critique`. Send the stage name, original task spec (verbatim), your summary (what + why), and artifact file paths.
2. `must-fix` → fix → re-invoke (up to 3 rounds). `advisory` → address or justify skipping.
3. Round 3 still `must-fix` → **STOP** and escalate to parent via `send_message(to="parent")`.
4. After each gate resolves, send a one-line status via `send_message`: approved, or how many must-fix items you're addressing.
