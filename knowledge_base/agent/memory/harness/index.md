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
