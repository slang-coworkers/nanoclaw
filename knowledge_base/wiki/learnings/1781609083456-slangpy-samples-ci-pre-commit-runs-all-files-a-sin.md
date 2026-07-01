---
title: "slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR"
type: learning
topic: slang-compiler
source: learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md
---

# slangpy-samples CI pre-commit runs --all-files; a single un-newlined file reds every PR

slangpy-samples CI (`.github/workflows/pre-commit.yml`) runs `pre-commit run --all-files --show-diff-on-failure`. Because it's `--all-files` (not just changed files), **one** pre-existing violation anywhere in the tree fails the `pre-commit` job on **every** PR, regardless of what that PR touches. Observed: `CONTRIBUTING.md` was added in #44 (`db0a79e`) with no trailing newline → `end-of-file-fixer` reds all open PRs. Fix is a standalone 1-byte EOF-newline PR off `main` (don't bundle into a feature PR), which greens the job repo-wide.

**Verifying an end-of-file-fixer fix GPU-free / without committing:** `pre-commit` isn't on PATH and system pip is PEP-668-blocked — use a venv: `python3 -m venv /tmp/pcvenv && /tmp/pcvenv/bin/pip install pre-commit`, then `/tmp/pcvenv/bin/pre-commit run end-of-file-fixer --files <f>`. First run clones the hook repo (needs network, ~1 min, then cached). Confirm BOTH directions: hook `Failed`/exit 1 on the broken version, `Passed`/exit 0 after — don't just assert the failing case from byte inspection if the PR body claims it.

**Push/identity for slangpy-samples (same as slangpy):** origin remote is `https://x-access-token:placeholder@github.com/...` with a global `url.<placeholder>.insteadof` rewrite; the real token is injected at push time by the onecli wrapper (`gh auth` shows `ROUTED_VIA_ONECLI`). No `gh auth setup-git` needed. Worktrees have no git identity — set repo-local `user.name "nv-slang-bot[bot]"` / `user.email "274397474+nv-slang-bot[bot]@users.noreply.github.com"` (matches existing bot commit authorship). Never `--global`.

**Critique gate is circular for PR-creation tasks:** the `gate-critique-on-deliver.sh` PreToolUse hook blocks `gh pr create` until PLAN/CODE/OUTPUT critiques are recorded. PLAN_REVIEW will flag "no PR exists yet" as must-fix — that's expected/circular (the gate itself blocks creation); only OUTPUT_REVIEW=approve is required to pass. codex reads artifacts itself and WILL flag overstated PR-body claims (e.g. "fails every open PR", "16 files pass") as must-fix — keep the body to what you personally verified.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781609083456-slangpy-samples-ci-pre-commit-runs-all-files-a-sin.md`_
