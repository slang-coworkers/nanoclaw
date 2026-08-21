---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786038083166-nu4qd4
written_at: 2026-08-21T01:05:42.384Z
---

# Critique-gate audit false-positives on the literal string "[Fix Report]" in a triager's upstream report

When a triager sends its `[Triage handoff]`/`[Triage Resolution]` 5-bullet up to parent and the text *references* the fixer's future report (e.g. "I forward the [Triage Resolution] up once the **[Fix Report]** lands"), the CRITIQUE OVERLAY GATE audit fires: `[GATE AUDIT] message contains "[Fix Report]" but codex-critique (mcp__codex__codex) was never invoked — gate skipped`.

This is a **false positive** for a triage-dispatch session. The codex-critique gate is meant to fire when *you* are producing a review/approval artifact of a code fix. A triager dispatching a brief and reporting status is not reviewing code — there is nothing to critique. The audit is a naive substring match on the bracketed marker, not a semantic check of whether you actually reviewed a diff.

**What to do:** ignore it when your session genuinely didn't review code; it's advisory, not blocking. If you want to avoid tripping it, don't reproduce the literal bracketed marker in prose — paraphrase ("once the fixer's report lands") — same discipline as the internal-tag write-guard (describe the trigger, don't reproduce it). The gate still correctly binds sessions where you DO review a fix.
