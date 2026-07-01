---
title: "auto-route background fork can fully run the fix workflow in your own worktree — adopt via GitHub PR dedup"
type: learning
topic: agent-ops
source: learnings/1782390736339-auto-route-background-fork-can-fully-run-the-fix-w.md
---

# auto-route background fork can fully run the fix workflow in your own worktree — adopt via GitHub PR dedup

On a slang-fixer issue (shader-slang/slang#11751, 2026-06-25), the `AUTO-ROUTE` UserPromptSubmit hook spawned a **background fork that executed the entire /slang-fix-issue workflow in parallel inside my own worktree/branch** — it edited the file, committed twice, pushed, ran codex PLAN/CODE critiques, opened the draft PR, applied the label, posted the issue 5-bullet, and dispatched CI — all while my main session was running the same steps.

**Tells that this is happening:** (1) an `Edit` fails with "File has been modified since read"; (2) `git reflog`/`git log` show commits you didn't author (correct `nv-slang-bot[bot]` identity); (3) the worktree HEAD advances between your checks; (4) `/tmp` PR-body files appear at a path you didn't write; (5) the shared `/workspace/.claude/workflow-state.json` shows critique stages/verdicts you didn't run.

**Crucially this is NOT the CLAUDE.local.md "peer-session collision" the abort rule targets.** Verify: `ncl sessions list` shows exactly ONE session on the issue thread (yours), `ps` shows one claude process, and NONE of the enumerated peer triggers exist (no sibling `wt-<other>/`, no foreign `build/`, no concurrent `ninja`, no peer stand-down message). It's an in-session runaway fork (the documented "background research fork over-ran the workflow" mechanism, learning 1782145876334) — there is no separate owner session to cede to.

**Resolution — drive to completion, don't yield, don't re-do:** You cannot message or stop an in-session fork. Yielding risks the worst outcome (a pushed branch with no PR → silent issue). Re-doing risks a duplicate PR. The safe path: GitHub enforces **one PR per head→base**, so `gh pr create` returns "a pull request already exists: #N" instead of duplicating — adopt #N and finish (`report_pr_created`, CI dispatch, peer review, report). Then AUDIT the fork's artifacts and correct them:
- Verify `Closes #N` linkage with `gh pr view N --json closingIssuesReferences`. The fork's `Closes #11751` was **backtick-wrapped** (`` `Closes #11751.` ``) → GitHub does NOT parse closing keywords inside inline-code spans → empty linkage / no auto-close. Refresh the body (`gh pr edit --body-file`, a non-gated Step-9 action) with a plain-text `Closes #N`.
- Don't duplicate the issue 5-bullet comment or the peer-review dispatch if the fork already did them (check first; the comment is visible via `gh issue view --json comments`).
- Re-verify any triage-memo code claims the fork (or you) propagated into the PR body.

Note in your upstream [Fix Report] that a fork may emit a duplicate report so the parent can dedup, and state which PR/session is canonical (`report_pr_created` binds the PR to whichever session calls it last).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782390736339-auto-route-background-fork-can-fully-run-the-fix-w.md`_
