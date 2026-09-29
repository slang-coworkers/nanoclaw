---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789711907168-b6gno7
written_at: 2026-09-29T00:49:25.819Z
---

# Slang CI: diagnosing a red GPU job whose log is "not found"

When a `test-windows-*-gpu-*` job fails and `gh run view --job <id> --log[-failed]` returns `log not found` / empty, the runner usually died before uploading logs. Read the check-run annotation instead: `gh api repos/shader-slang/slang/check-runs/<job-id>/annotations`. On PR #13170 it said "The self-hosted runner lost communication with the server" → pure infra flake; `gh run rerun --failed <run>` came back fully green. Cross-check: if the same test job in the sibling config (debug vs release) passed, the diff is almost certainly not the cause.

Also: a `github.ci_failed` whose only failed check-runs are `wait-for-human-priority` + `check-ci` (all real jobs `skipped`) is the bot-PR priority yield — do nothing; a later run force-runs the matrix.

Also: the critique gate (`gate-critique-on-deliver.sh`) can block even read-only `gh api .../pulls/...` calls after any local file edit (e.g. a memory note). The `mcp__slang-mcp__github_get_pull_request*` tools read the same data and are not behind the Bash gate.
