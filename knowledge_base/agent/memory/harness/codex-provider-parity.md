---
type: reference
title: Codex-as-provider parity vs Claude (empirical, 2026-05)
description: Durable structural differences when a NanoClaw agent group runs on the Codex provider instead of Claude — headline is that settings.json hooks are inert for Codex. Distilled from the May-2026 parity test; verify implementation-detail claims against current codex.ts before relying.
tags: [codex, provider, hooks, parity, superseded-detail]
resource: "distilled from the deleted codex-parity-test-results.md + plan-triage-fixer-ab-test.md (May 2026 R&D)"
---

# Codex-as-provider parity vs Claude

Empirical parity test, 2026-05-09/10 (`codex-parity-test` vs the Claude `slang-triager`).
Kept for the **durable structural finding**; the implementation-detail rows are dated —
re-check `container/agent-runner/src/providers/codex.ts` and `src/container-runner.ts`
before treating them as current.

## Durable structural finding — hooks are inert for Codex

The whole `settings.json` hook stack (`PreToolUse`/`PostToolUse`/`UserPromptSubmit`
with intent-router, plan-gate, critique-record-gate, edit-counter, dashboard event
stream) fires via the **Claude Agent SDK**. Codex has its own approval/policy system
and does **not** run these hooks — so for a Codex group they are **dead configuration**:
0 dashboard events, no plan-gate, no critique-gate, no intent routing. This is an
architectural property of the provider split, not a bug, and unlikely to change without
provider-level hook points in the poll loop.

**Implication:** overlay-gated enforcement (plan gate, critique-before-PR) cannot be
assumed on a Codex group. Route autonomous code-writing that depends on those gates to a
Claude group, or accept the gap for review/critique-only Codex use.

## What works (verified, likely still true)

- **baseInstructions reach Codex.** It correctly reports its coworker type from the
  composed `CLAUDE.md`. The group folder carries an `AGENTS.md → CLAUDE.md` symlink and
  Codex reads it natively.
- **Skill files are readable** from the container FS (`/home/node/.claude/skills/*/SKILL.md`).
- **Free-form A2A handoff is sufficient** — a plain-text triage→fixer handoff worked as
  well as structured JSON; no structured brief required (task #13, 2026-05-10: fixer
  variants A/B/D all parsed the same `Priority+Component+Summary+Files+Action` handoff and
  produced senior-level output; the orchestrator, which has full context, should craft the
  handoff rather than forcing triage to forward directly).
- **Codex follows overlay/critique text voluntarily, even though the hooks are inert.**
  On triage #943 (2026-05-10) the Codex `slang-triager` read the critique-overlay
  instructions embedded in its `CLAUDE.md` and *voluntarily* ran both DIAGNOSIS_REVIEW and
  OUTPUT_REVIEW — with **no** hook enforcement to compel it. So the inert-hooks finding
  above is about the *enforcement* mechanism, not instruction-following: Codex honors
  structured-workflow text delivered through `baseInstructions`, it just can't be *forced*
  to. Treat overlay text as advisory-but-usually-honored on Codex, not as a hard gate.

**Observability caveat (the real cost of inert hooks):** because the hook stack is what
emits dashboard events, a Codex group is a **blind spot** — zero tool-call counts, no MCP
usage visibility, only the final outbound messages are observed. On triage #943 the Claude
variant was scored higher on depth and observability; Codex was faster (~3 min vs ~7) and
showed strong voluntary workflow compliance.

## Dated implementation details — VERIFY before relying (May 2026)

- `OVERLAY_HAS_PLAN` / `OVERLAY_HAS_CRITIQUE` env vars were **not injected** into the
  Codex container (a small gap in `src/container-runner.ts`), leaving even the intended
  overlay signals dead. May since be fixed — check before citing.
- Codex **exits code 1 on normal shutdown** (processing_ack still "completed"),
  obscuring real failures in logs.
- Asked "what skills do you have," Codex lists its own native plugins
  (`imagegen`, `skill-creator`, …) rather than the NanoClaw skills — cosmetic; the
  NanoClaw skills are still injected via `baseInstructions`.
