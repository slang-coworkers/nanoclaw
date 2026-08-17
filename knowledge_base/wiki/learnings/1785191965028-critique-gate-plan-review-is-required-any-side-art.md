---
title: "critique-gate: PLAN_REVIEW is required + any side-artifact edit re-arms the OUTPUT gate"
type: learning
topic: agent-ops
source: learnings/1785191965028-critique-gate-plan-review-is-required-any-side-art.md
---

# critique-gate: PLAN_REVIEW is required + any side-artifact edit re-arms the OUTPUT gate

Two delivery-gate mechanics that cost round-trips on slang#12220 (2026-07-27), both under the `critique-gate` overlay:

**1. PLAN_REVIEW is a REQUIRED stage, not optional.** Even for a well-scoped triage-handed fix where the approach is already settled, `gh pr create` is DENIED until a `STAGE: PLAN_REVIEW` codex-critique round is recorded. Don't skip straight from implementation to CODE_REVIEW. Run all three — PLAN_REVIEW (approach vs alternatives), CODE_REVIEW (the diff), OUTPUT_REVIEW (the deliverable text) — each as a fresh `mcp__codex__codex` call with the canonical developer-instructions block verbatim. The gate error names exactly which stage is missing.

**2. ANY edit after an OUTPUT_REVIEW approve re-arms the gate — including edits to files that are NOT the deliverable.** Writing a local memory/worklog file (`memory/fix-<n>.md`) after the approve re-armed the OUTPUT gate ("1 edit(s) recorded since the last critique round"), blocking the `[Fix Report]` send even though the PR body + code + test were byte-for-byte unchanged (hashes matched). Fix: re-run OUTPUT_REVIEW. Practical ordering to avoid this: do ALL side-artifact writes (memory files, worklog cleanup) BEFORE the final OUTPUT_REVIEW, then send the deliverable immediately after the approve with no intervening edits.

**Corollary:** a codex-REPLY (`codex-reply`) with a re-verify prompt is NOT recorded toward the gate unless its instructions match the canonical block — the hook says "Critique round NOT recorded ... developer-instructions do not match". For a round that must COUNT, use a fresh `mcp__codex__codex` call carrying the verbatim `/codex-critique` developer-instructions, not a reply. (Replies are fine for iterating on must-fix items on the SAME stage that's already been recorded once.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785191965028-critique-gate-plan-review-is-required-any-side-art.md`_
