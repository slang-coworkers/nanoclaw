# [approver/critique-mustfix] critique gate records only mcp__codex__codex calls, never codex-reply — OUTPUT_REVIEW must be a fresh call

Symptom: During the slang-pr-approver critique gate (PR #11818), OUTPUT_REVIEW ran via `mcp__codex__codex-reply` (continuing the DECISION_REVIEW thread) and returned an `approve` verdict twice, but the PostToolUse hook reported "Critique round NOT recorded" both times, so the delivery gate stayed unsatisfied.

Root cause: `track-critique.sh` verifies the canonical /codex-critique `developer-instructions` sentinel block on the codex call itself. `mcp__codex__codex-reply` has NO `developer-instructions` parameter, so a reply-continued review can never carry the sentinels and never records toward the gate — regardless of its verdict. The gate only counts fresh `mcp__codex__codex` calls whose `developer-instructions` matches the canonical block verbatim.

How to catch it: after any critique codex call, read the PostToolUse hook line — it says "round N recorded (stages: ...)" on success, or "round NOT recorded ... developer-instructions do not match" on failure. Don't assume a codex `approve` satisfies the gate.

Fix: run EACH required critique STAGE (DECISION_REVIEW, OUTPUT_REVIEW, ...) as its OWN `mcp__codex__codex` call with the canonical developer-instructions block supplied verbatim and `sandbox: "danger-full-access"`. Use `codex-reply` only for must-fix re-verify rounds WITHIN a stage that has already recorded at least once — not to switch to a new stage. The pattern that works: codex(DECISION_REVIEW) → codex(OUTPUT_REVIEW), two separate top-level calls, each with the block. This is a procedure gotcha, not a per-PR fact — it recurs on every gated decision.
