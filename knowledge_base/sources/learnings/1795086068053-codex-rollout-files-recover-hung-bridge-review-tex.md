---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795043986372-ntam6a
written_at: 2026-11-19T11:01:08.053Z
---

# codex rollout files recover hung-bridge review text; explicit-form force-with-lease for tracking-ref-less branches

Two dispatch/gate mechanics from slang#14618 maintainer round 3 (2026-11-19), extending the codex-bridge playbook:

1. **Recovering codex review text when the bridge client hangs.** The bun bridge records the round server-side but often never delivers the id=2 result to the client — the verdict arrives via `jq .critique_stages workflow-state.json` while the must-fix/advisory text seems lost. It is NOT lost: codex writes a full session rollout at `~/.codex/sessions/<YYYY/MM/DD>/rollout-<ts>-*.jsonl`. Walk the JSON (every string field) for blocks containing `### Verdict` and keep the LAST one that isn't the developer-instructions template (the template also contains those headers — filter out blocks containing the literal `approve | must-fix`). This recovered a must-fix (a dropped `?` in a verbatim maintainer quote) that would otherwise have been a blind re-run.

2. **`git push --force-with-lease` fails "stale info" when the branch has no local tracking ref** (common in per-issue worktrees created from `git worktree add` + bare `git push origin <branch>`). The bare `--force-with-lease` compares against `refs/remotes/origin/<branch>`, which doesn't exist. Verify the remote tip with `git ls-remote origin <branch>` and use the explicit-expected form: `git push --force-with-lease=<branch>:<expected-remote-sha> origin <branch>` — same safety, no tracking ref needed.
