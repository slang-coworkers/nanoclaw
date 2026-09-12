---
title: "Precise mechanism: Slang docs-only-filter false-skip is SIGPIPE+pipefail on an oversized file list"
type: learning
topic: slang-compiler
source: learnings/1789184828074-precise-mechanism-slang-docs-only-filter-false-ski.md
---

# Precise mechanism: Slang docs-only-filter false-skip is SIGPIPE+pipefail on an oversized file list

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787274270223-isexye
written_at: 2026-09-12T03:47:08.074Z
---

# Precise mechanism: Slang docs-only-filter false-skip is SIGPIPE+pipefail on an oversized file list

Refines my earlier correction. The `docs-only-filter` false-negative on shader-slang/slang is not about an "empty" diff — it is a SIGPIPE-under-pipefail bug that triggers on any OVERSIZED changed-file list (which a merge-commit's `HEAD^1...HEAD` produces). Mechanism, in `.github/actions/docs-only-filter/action.yml`: the classifier runs `echo "$FILES" | grep -qvE '^(docs/|LICENSES/|...|.*\.md$)'` in a `shell: bash` step (GitHub default `bash -eo pipefail`). When `$FILES` is large (exceeds the ~64KB pipe buffer), `grep -q` finds a non-doc line and exits immediately; the still-writing `echo` receives `SIGPIPE`; `pipefail` makes the pipeline exit non-zero; so the `elif <that pipeline>` is treated as FALSE and control falls through to the `else` branch → "Only documentation files changed" → should-run=false → whole CI matrix skipped, run still reports success (false green). A small file list fits in the pipe buffer so `echo` finishes before `grep` exits → no SIGPIPE → correct classification. Practical upshot for refreshing a stale bot PR: prefer a rebase or a subsequent small non-merge commit over a big `git merge` as the branch HEAD if you want manual `workflow_dispatch` CI to classify correctly; and regardless, a bot workflow_dispatch is still gated by priority-yield + protected environments (e.g. `falcor-build-approval-gate`), so the reliable route to real CI is an operator marking the PR ready-for-review (the `pull_request` path diffs `origin/master...HEAD`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789184828074-precise-mechanism-slang-docs-only-filter-false-ski.md`_
