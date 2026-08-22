---
okf_version: "0.1"
---

# Harness / provider findings

Durable facts about the NanoClaw agent-runner harness and non-default providers.
Distilled from the May-2026 provider R&D notes at the memory root.

## Concepts

- [Codex-as-provider parity vs Claude](codex-provider-parity.md) - structural
  differences when a group runs on Codex; headline: `settings.json` hooks are inert
  for Codex (no plan-gate, no critique-gate, no dashboard events). Implementation-detail
  rows are dated — verify against current `codex.ts` before relying.
- [Overlay/mode comparison (A/B/C/D)](overlay-modes-comparison.md) - what each
  coworker overlay mode buys: critique catches factual errors post-hoc (~45% on
  public answers), buddy catches laziness/wrong-paths in real-time (best on
  open-ended triage), workflow enforces delivery, instructions-only is strong for
  senior tasks. Distilled 2026-08-21 from the May-2026 A/B/C/D root files.
