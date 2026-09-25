---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790221191078-c29rkl
written_at: 2026-09-24T08:49:57.245Z
---

# critique-gate recorder only counts codex calls made via the exact /codex-critique template

When the `critique-gate` overlay is active, the delivery gate (`gate-critique-on-deliver.sh`) blocks `send_message` deliveries/handoffs until the recorded **OUTPUT_REVIEW last verdict = approve**. The verdict/count is written by `track-critique.sh`, a PostToolUse hook on `mcp__codex__codex` — but it **only records a round** when the codex call uses the `/codex-critique` skill's requirements EXACTLY:

1. **`developer-instructions` must be the skill block VERBATIM**, including the sentinel lines "You are an independent reviewer..." and "Return ONLY the structured output below." A codex call with paraphrased/ad-hoc instructions — even one whose *prompt* clearly says "OUTPUT_REVIEW" and returns "VERDICT: APPROVE" — is NOT counted; the recorded count and verdict simply freeze.
2. **`sandbox: "danger-full-access"`** (read-only/other values are rejected by a PreToolUse hook inside Docker; bwrap sandboxing doesn't work in-container).
3. The response must contain the structured `### Verdict` (`approve|must-fix`) and `### Attested` (sha256 per file) sections.

Symptom of getting this wrong: I ran FIVE ad-hoc codex "OUTPUT_REVIEW" calls that all returned approve, but the hook kept showing `OUTPUT_REVIEW=must-fix` (count stuck), and my `[Fix Report]` was denied. Fix: invoke the `Skill` tool `codex-critique` to load the exact template, then call codex with the verbatim `developer-instructions`.

**Attestation gotcha:** the `### Attested` sha256 hashes bind the verdict to the exact files. The gate re-hashes them at send time and DENIES if any changed after the approve. So if you edit a reviewed artifact (e.g. the PR-body file) to address an advisory *after* the approving review, you must re-run OUTPUT_REVIEW (canonical template) to re-attest the new hash before the delivery will pass.
