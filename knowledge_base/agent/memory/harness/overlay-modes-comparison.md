---
type: reference
title: Overlay/mode comparison — instructions vs workflow vs critique vs buddy (A/B/C/D, 2026-05)
description: What each coworker overlay mode empirically buys — critique catches factual errors post-hoc (~45% on public answers), buddy catches laziness/wrong-paths in real-time (best on open-ended triage), workflow enforces delivery, instructions-only is surprisingly strong for senior tasks. Distilled from the May-2026 A/B/C/D experiments; verify overlay wiring against current composer before relying.
tags: [overlay, buddy, critique, workflow, ab-test, superseded-detail]
resource: "distilled from the deleted root files full-abcd-comparison.md, full-abcd-comparison-v2.md, fixer-ab-test-943.md (May 2026 R&D)"
---

# Overlay/mode comparison (A/B/C/D empirical, 2026-05)

Four coworker variants were run head-to-head on the same tasks (Discord support,
triage of slangpy#943, fixer review of PR #963) to measure what each overlay
adds. Kept for the **durable per-overlay value proposition**; tool-count tables
and star scores were point-in-time and are not reproduced. Re-check overlay
wiring in the composer (`src/claude-composer/`, `container/skills/*/`) before
treating the mechanics as current.

## The variants

- **A — instructions-only** (`slang-writer`-style, no enforced workflow/overlay).
- **B — workflow-typed** (enforced workflow steps, e.g. fix-issue / triage-issue).
- **C — workflow + critique** overlay (codex critique gate).
- **D — workflow + buddy** overlay (background codex monitor watching the run).

## Durable per-overlay findings

- **Critique catches factual errors post-hoc.** ~45% error-catch rate on
  Discord public answers — essential for accuracy-critical, public-facing output
  where a wrong claim is expensive. It reviews the *output*.

- **Buddy catches laziness and wrong paths in real-time.** The killer result: on
  triage, buddy's codex flagged that the agent had leaned on a prior report
  instead of doing a fresh research pass; the agent course-corrected, diffed the
  actual PR-branch files against main, and found **6 concrete reviewer items that
  both A and B missed entirely**. Buddy watches the *process*, so its value is
  greatest on open-ended tasks (triage, investigation) and marginal on focused,
  well-specified tasks (code review / fixer) — on a clean fixer run it had
  nothing to catch and only added overhead.

- **Workflow enforces delivery but not tool discipline.** Workflow-typed variants
  reliably called `send_message` to report up, but did **not** stop the agent from
  taking `gh` CLI shortcuts around the intended MCP/DeepWiki path.

- **Instructions-only (A) is surprisingly strong for senior-level tasks.** For
  this caliber of work the model's internal quality bar matched external
  enforcement: A produced senior-engineer output fastest, and even
  *self-initiated* a codex critique without being told to. Workflow added little
  when a capable general tool (gh CLI) was already available.

- **Speed vs rigor is a real, roughly monotone tradeoff.** A ≈ 7 min, B ≈ 20 min,
  C ≈ 40 min for comparable end quality; D varies with whether the buddy spawns.
  Rigor buys verification confidence and audit trail, not obviously better output.

## Overlay composition hazard

Buddy and critique are **mutually exclusive** — buddy types run with overlays
disabled, because an early build let the critique-tracker counter miscount
buddy's own codex calls (a false-positive that buddy itself diagnosed). The
lesson generalizes: **overlay composition needs explicit testing**; two overlays
that each touch the codex/critique path can collide.

## Production recommendation (mode → use case)

- Accuracy-critical public output (Discord answers) → **critique (C)**.
- Open-ended thoroughness (triage, investigation) → **buddy (D)** — the only
  variant that forced a deeper research pass.
- Latency-sensitive delivery → **workflow (B)** (fastest reliable delivery) or
  **instructions-only (A)** (fastest overall).
- Focused code review / fixer → **A or B**; buddy adds overhead without benefit.

## Dated implementation detail — VERIFY before relying (May 2026)

The v1 run predated a buddy fix: buddy only genuinely relayed through codex, sent
full base context to codex at setup, and stopped polluting the critique counter
**after** the v2 re-run (2026-05-10). Treat any buddy-relay mechanics here as
historical; confirm against the current buddy skill + hook chain.

Related: provider-level parity (Codex ignores `settings.json` hooks, so overlay
enforcement is inert on a Codex group — but Codex still follows overlay text
voluntarily) and the free-form triage→fixer handoff finding both live in
[[codex-provider-parity.md]].
