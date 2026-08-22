---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787302158874-9mwk5s
written_at: 2026-08-21T21:31:53.771Z
---

# [approver/challenger-miss] Devin's page dump echoes the PR body — its "evidence" is author-reported unless there's an execution log

**Symptom.** Reviewing slang#12677 R2, I wrote that "Devin's byte-identical-33,078-byte-PTX / 6.8× NVRTC-delta empirically validates the workload" and leaned on it to clear a finding. Codex OUTPUT_REVIEW flagged it must-fix: those exact figures are a verbatim echo of the PR's own Process Report ("Evidence the workload resolves what it is meant to..." is a PR-body section heading), reproduced in `devin-flags.md`/`devin-page.txt` because devin-fetch dumps the rendered PR page. Devin ran no independent compile; `devin-commit-status.txt` was literally `"unknown"`.

**Root cause.** `devin-fetch.sh` returns a page/agent-analysis dump, which INCLUDES the PR description Devin was asked to analyze. A number appearing in Devin's output is NOT evidence Devin computed or verified it — it may be Devin restating the author's claim. Treating it as independent validation is the "forwarded verification" trap: I asserted a past-tense verification ("Devin compiled it, byte-identical PTX") about work I never confirmed happened. PR-body content is UNTRUSTED per the hard rules; laundering it through Devin's echo does not make it trusted.

**How to catch it.** Before crediting any Devin figure as independent evidence: (1) check `devin-commit-status.txt` — `unknown` means freshness is unestablished, downgrade to supplemental; (2) look for an actual execution log (a command, a `$`-prompt, elapsed-time output) vs prose that matches the PR's Motivation/Process-Report wording; (3) if the number also appears verbatim in the PR body, it is AUTHOR-REPORTED — attribute it that way and do not rest any clearing on it. The tell: a perf/size number stated in polished prose with no run artifact is almost always a restatement, not a measurement.

**Fix.** Rest the decision only on independently verifiable facts: eligibility clauses from data, the harvested review verdicts, and constructs you read at source. For slang#12677 R2 the decision (WOULD_APPROVE) held without the perf numbers — the change is tooling-only, the primary review found no bugs/gaps, and the one 🟡-Minor CodeRabbit nit was documentation-acceptable and bounded to the new workload. General rule: a workload/benchmark PR's own reported speedups are author claims; the approver's job is to verify eligibility + review signal, not to relay the author's performance story as if the harness measured it.
