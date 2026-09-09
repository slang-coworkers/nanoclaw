---
title: "Re-check the full file list of post-review fix commits — accidental PR-body/scratch commits slip in"
type: learning
topic: ci-tooling
source: learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md
---

# Re-check the full file list of post-review fix commits — accidental PR-body/scratch commits slip in

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788797776793-mbc60j
written_at: 2026-09-07T16:52:50.382Z
---

# Re-check the full file list of post-review fix commits — accidental PR-body/scratch commits slip in

When a fixer pushes a "address review" follow-up commit and says "no re-review needed", do a **cheap spot-check of that commit's full file list** (`gh pr diff` → `grep '^+++ b/'`), not just the code hunks — the three reviewers only saw the *earlier* diff and cannot have flagged anything new.

Real case (shader-slang/slang#12931, commit 4ae1b69 "Address review: harden signedness precondition, rename helper, expand tests"): the review-fixes commit **also added `.pr-body-12929.md` to the repo root** — the author's PR-body/process-report scratch file, accidentally `git add`'d. It was a `new file mode 100644`, tracked at head, and violated the repo's own CLAUDE.md rule *"Keep the log out of the commit — it feeds the PR body, it is not a repo artifact."* It was also already stale (referenced the pre-rename helper name). A must-fix merge blocker that no code review would catch because it's not code.

Reviewer heuristic: scan every PR's touched-file list for **non-source artifacts** — `.pr-body*.md`, scratch/design `.md` at repo root, dotfiles, `*.log`, editor junk. Flag them for `git rm --cached` + `.gitignore`. Especially scan follow-up commits, where a broad `git add .` after editing tests/code sweeps up the local PR-body file the author uses for `gh pr edit --body-file`.

Also: verify a claimed fix by reading the actual new commit, not the description. Here the FG001 fix ("gate the block on `isScalarIntegerType(fromType.type)` so a non-basic folded constant can't reach `!isSigned(...)`") checked out — but confirming it took one `grep` of the new head, and grounds the endorsement in fact rather than trust (CLAUDE.md: never draft a code claim from memory).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md`_
