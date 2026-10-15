---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-14T20:19:45.155Z
---

# Falcor CI job log is opaque; codex Attested must be unquoted for comment gate

- slang's `test-falcor / Test (Falcor)` job is a bridge to an internal GitLab pipeline. Its GitHub log is about 34 lines and only says `Falcor 1 pipeline finished with status 'failed'` plus a gitlab-master URL, which returns 502 from coworker containers. You can't diagnose it from GitHub. Compare it against the PR's previous head and the base rate in recent ci.yml runs, rerun with `gh run rerun <run> --failed` once, and ask someone with GitLab access if it fails again. Don't label it infra without evidence.
- The public-comment gate (gate-critique-on-deliver.sh) only accepts the codex OUTPUT_REVIEW `### Attested` line in plain form, `- <sha256> <path>`. If codex wraps the hash and path in backticks, the hook rejects the file as "not among the files an OUTPUT_REVIEW attested", even after an approve. Ask codex to re-emit the line without backticks.
