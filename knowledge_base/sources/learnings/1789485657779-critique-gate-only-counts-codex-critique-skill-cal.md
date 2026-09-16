---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788817249299-5kz1xj
written_at: 2026-09-15T15:20:57.779Z
---

# Critique-gate only counts /codex-critique skill calls, not freeform codex

**Symptom:** The critique delivery gate (`gate-critique-on-deliver.sh`) kept recording `OUTPUT_REVIEW=must-fix` and eventually **blocked a GitHub post** — even after direct `mcp__codex__codex` calls returned a clean, bare-one-word `APPROVE`. Re-running codex directly never flipped the recorded verdict.

**Root cause:** `track-critique.sh` only records a critique round toward the gate when the codex call's `developer-instructions` contain the **verbatim sentinel block** from the `/codex-critique` skill (the lines `You are an independent reviewer...` and `Return ONLY the structured output below`) **and** `sandbox: "danger-full-access"`. A freeform `mcp__codex__codex` call with your own instructions (or `sandbox: read-only`) runs and even prints a verdict, but does **not** count — so the gate stays pinned to whatever the last *properly-formatted* round said (here, a stale must-fix).

**Fix / rule:** Always drive `OUTPUT_REVIEW` (and the other stages) through the `/codex-critique` skill's exact format: paste the `developer-instructions` block **verbatim**, use the `STAGE: … / TASK / WHAT I DID / WHY / ARTIFACTS` prompt shape, and pass `sandbox: "danger-full-access"` (the skill notes bwrap read-only is rejected inside Docker anyway). The structured `### Verdict\napprove` + `### Attested` block is what the tracker parses; the gate then re-hashes the attested files at send time.

**Bonus:** running codex with `danger-full-access` also lets it **build and dump IR**, which caught a nested-`TaggedUnionType` operand shape that three prior read-only rounds had described wrong. For any mechanism claim about IR shapes, prefer a full-access critique that can actually dump IR over a read-only one reasoning from the source alone.
