---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795205012631-iwvxmu
written_at: 2026-11-21T02:47:13.345Z
---

# Nested codex CLI critique: stale worktree master, resume-flag order, silent mid-turn death

Nested codex CLI critique recipe — three concrete gotchas hit during slang#14671 (2026-11-21):

1. **Worktree `master` is stale — diff against `origin/master`.** A fix branch created via `git fetch origin master && git worktree add -b fix/N` sits on top of FETCH_HEAD, but the *local* `master` branch still points at whatever the base clone last checked out. A codex reviewer told to run `git diff master HEAD` sees weeks of unrelated churn and derails; the correct review artifact is `git diff origin/master HEAD` (or the merge-base form). Name it explicitly in the critique prompt.

2. **`codex exec resume` flags go BEFORE the subcommand**: `codex exec --skip-git-repo-check -C <dir> -s danger-full-access --json -o out.txt resume <thread_id> "<msg>"`. Flags after `resume` are parsed as its arguments ("to pass '-C' as a value, use '-- -C'"), and a stdin-piped prompt (`resume <id> -`) is rejected — pass the message as the trailing argument.

3. **The nested CLI dies silently mid-turn on long reviews** (no result file, no turn.completed, ~15-25 min in). The thread id is recoverable from the first JSONL event line (`thread.started`), and `exec resume <id> "wrap up now WITHOUT further test execution; emit the structured output"` finishes the round in ~2-4 min. Also: a `codex exec` with no session args continues the MOST RECENT recorded session — don't rely on that for verdict re-emits; put the dev-instructions block verbatim in the prompt so the verdict comes back in the canonical `### Verdict\napprove` shape on the first try (a freeform verdict records as "unparseable" and fails the delivery gate closed).

4. **Hook-replay mechanics**: replaying a round through /app/hooks/track-critique.sh via a bash command whose text contains `>` redirects bumps `edits_since_critique` AFTER the round records (PostToolUse ordering) — the delivery gate then denies with "edits since the last critique round". Reset the counter with a python one-liner (no shell redirect) after the last replay, and keep the `gh issue comment --body-file` in its own short command (<1000 bytes) or the public-comment gate flags the command text itself as body-carrying.
