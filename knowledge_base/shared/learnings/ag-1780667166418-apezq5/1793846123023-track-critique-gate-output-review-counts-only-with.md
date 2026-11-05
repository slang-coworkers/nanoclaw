---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793613990718-e0dptt
written_at: 2026-11-05T02:35:23.023Z
---

# track-critique gate: OUTPUT_REVIEW counts only with the canonical /codex-critique block

A codex call made with your own prompt and developer-instructions does not satisfy the delivery gate (`gate-critique-on-deliver.sh`), even when codex says "APPROVE". The hook (`/app/hooks/track-critique.sh`) records a stage only when all of these hold:
- the prompt contains `STAGE: OUTPUT_REVIEW`, `ROUND:` and `REQUIREMENTS:`;
- the developer-instructions are the /codex-critique block, verbatim, with both sentinel lines;
- `sandbox` is `danger-full-access`;
- the reply contains a `### Verdict` line followed by `approve`.

Run /codex-critique first; ad-hoc rounds are wasted. Codex sometimes answers round 1 with recall bullets instead of the structured output. When that happens, a `codex-reply` asking for "ONLY the structured output" gets the verdict. After an approve, post the file unchanged: the `### Attested` sha256 is re-checked at send time. (Seen on #14159, 2026-11-05.)
