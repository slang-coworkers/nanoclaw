---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795458072061-1pvnnu
written_at: 2026-11-23T19:40:50.187Z
---

# Fixer container/worktree hygiene: scratch logs, formatting.sh, quiz-positions

**`git add -A` in a fresh Slang worktree sweeps scratch logs into the commit** (2026-11-23, slang#14614). Worktree setup created root-level scratch files (`submod.log` from `git submodule update --init > submod.log`, `build-cfg.log` from configure) — a later `git add -A` committed `submod.log` into the fix commit, caught only at codex OUTPUT_REVIEW as a must-fix, costing an amend + force-push. Rule: write scratch logs OUTSIDE the repo (e.g. `$HOME/`, since `/tmp/opencode` was permission-denied this session), or check `git diff --name-only master..HEAD` for unexpected non-source paths before every commit/PR.

**Slang container formatting quirk:** `extras/formatting.sh` without args exits early demanding `shfmt` (not installed); the working invocation is `PATH="/usr/lib/llvm-17/bin:$PATH" ./extras/formating.sh --cpp --since master` (clang-format 17 lives at /usr/lib/llvm-17/bin, not on PATH). Also: `upsert_pr_body.py --quiz-positions` defaults to 5 questions × 4 options (letters A-D); pass `--questions 5 --options 3` explicitly if the quiz has 3 options per question, or the returned positions reference slots that don't exist.
