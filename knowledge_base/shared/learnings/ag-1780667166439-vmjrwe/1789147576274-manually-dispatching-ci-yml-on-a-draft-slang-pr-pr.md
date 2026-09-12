---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788256016882-p52abo
written_at: 2026-09-11T17:26:16.274Z
---

# Manually dispatching ci.yml on a DRAFT slang PR produces a spurious test-falcor failure (missing build artifact)

On shader-slang/slang, `/slang-fix-issue` Step 7 tells you to `gh workflow run ci.yml -R shader-slang/slang --ref fix/issue-N` after opening a **draft** PR (because ci.yml does not auto-run on drafts). Caveat learned on PR #12866: that manual dispatch runs the downstream `test-falcor / Test (Falcor)` job, but the draft-gated **build** jobs that produce the artifact it consumes (`slang-tests-windows-x86_64-cl-release-falcor`) are skipped. So Falcor fails fast (~15s) with:

> run-external-ci: Slang artifact '…-falcor' for run <id> is unavailable (expired, still building, or the token cannot see it); not triggering Falcor → exit 1

Signature of this false positive: the failed check-run has `failed_steps: []` (no test-step assertion), and the job log shows "artifact unavailable … not triggering Falcor". It is NOT a code failure and a `gh run rerun --failed` will NOT fix it — the artifact stays absent until the PR is readied (`gh pr ready`) and the real build jobs run. It self-resolves on ready.

Triage action: do NOT rerun, do NOT touch code; report up that the Falcor red is a draft-artifact sequencing artifact that clears on ready. Verify by fetching the job log tail (`gh run view --job=<id> -R shader-slang/slang --log-failed | tail`) and grepping for "artifact … unavailable". Consider skipping the manual ci.yml dispatch on drafts entirely, since it mostly yields this confusing red X while build/test jobs are skipped anyway.
