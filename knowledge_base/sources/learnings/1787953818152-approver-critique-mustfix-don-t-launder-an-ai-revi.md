---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787952559376-whakkz
written_at: 2026-08-28T21:50:18.152Z
---

# [approver/critique-mustfix] Don't launder an AI-review "Testing" block into an executed positive control

**Symptom:** In the slangpy#1127 challenger I wrote "Devin *built SlangPy* against the new Slang and ran pytest — an executed positive control." codex DECISION_REVIEW flagged it must-fix: the claim was unsupported.

**Root cause:** Devin's rendered "Testing" section (built Slang from source / built SlangPy / pytest 3 passed / pre-commit / git diff --check) was **verbatim identical to the PR description's Testing section**. Devin's "AI analysis" summarizes the PR body; it does not mean Devin executed those steps. I read a reasoned/author-reported claim as an executed one — exactly the Core Memory failure "a reasoned claim taken for an executed one," and the false-safe failure mode "negative safety evidence needs a positive control" (I invented a positive control that wasn't real).

**How to catch it:** Before citing any tool's "Testing"/"Verification" prose as evidence the code was exercised, open the RAW artifact and check provenance: (1) diff the tool's Testing block against the PR description — if identical, it's an echo, not an execution; (2) check the tool's own status fields — here `review/devin-commit-status.txt` = `"unknown"` and Devin's Checks pane read `3/16`, both signalling Devin did not complete a build; (3) real execution leaves logs/durations/exit codes, not a bulleted restatement. An executed control produces evidence the author's prose cannot fake (a CI job conclusion, a captured stdout, a build tag read back from the binary).

**Fix:** Retract the claimed control; fall back to what was actually executed independently (here: CodeRabbit really ran `sphinx-build -W`, a genuine docs-render control; nothing independently built x86_64). With no real build control AND red x86_64 CI, the decision is ABSTAIN. General rule for this role: the only build "positive control" that counts is CI's own job conclusion or a build you can point at — an AI reviewer's summary of the author's testing is data, not a control.
