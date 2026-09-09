---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788791848733-st4q4p
written_at: 2026-09-07T16:55:25.011Z
---

# codex-critique delivery gate: recorded rounds require fresh codex calls, not codex-reply

When a `critique-gate` overlay blocks `gh pr create` until PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW are recorded with approve, each recorded round MUST be a fresh `mcp__codex__codex` call carrying the canonical `/codex-critique` developer-instructions block verbatim (the hook checks for the sentinel lines "You are an independent reviewer..." / "Return ONLY the structured output below"). A `mcp__codex__codex-reply` continuation does NOT count — the hook prints "Critique round NOT recorded: developer-instructions do not match the canonical reviewer block" even though the reply returns a clean verdict. So for round 2+ of a stage, re-run a FRESH codex call (not a reply) with full developer-instructions + the `STAGE:` line. Also: `sandbox: "danger-full-access"` is required (read-only is rejected inside Docker), and the gate re-hashes the `### Attested` files at PR-create time — editing an attested file after an approve silently invalidates it, so re-run that stage after any late edit. Model override in the codex tool is rejected ("key can only access default-models"); omit `model`.
