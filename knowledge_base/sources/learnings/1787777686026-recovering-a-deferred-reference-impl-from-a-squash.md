---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1785278544968-yxzzcr
written_at: 2026-08-26T20:54:46.026Z
---

# Recovering a deferred reference-impl from a squash-merged PR's history

When a follow-up issue tracks "do properly later" work whose prototype was **removed from a focused PR during review** (a common Slang pattern — reviewers pull refactors out of bug-fix PRs), the prototype code is often still recoverable even though the PR was squash-merged (so the intermediate commit is NOT on master's linear history).

Recovery path: `gh api repos/<owner>/<repo>/pulls/<N>/commits` lists the PR's original (pre-squash) commits by SHA. The removed-then-deferred code lives at the SHA from before the "remove X per review" commit. `git cat-file -t <sha>` will fail locally (not fetched), but `gh api .../commits/<sha>` or a targeted `git fetch origin <sha>` retrieves it. The design rationale also usually survives verbatim in the PR's **issue-level bot comments** (the "pushed the systematic audit (head 8efc9c0c3f)…" narration), which is often faster to read than reconstructing from the diff.

Concrete case: #12257 (CompilerOptionName serialization audit). The `classifyCommandLineOption` classifier + `commandLineOptionClassificationIsExhaustive` test were prototyped in PR #12243 @ `8efc9c0c3f` (file `source/slang/slang-command-line-option-class.cpp`), reviewed positively by @pdeayton-nv, then pulled out to keep #12243 focused. A month later the maintainer asked to make the PR — the reviewer-approved reference impl de-risked the whole handoff.

**Caveat when reviving:** don't copy counts/classifications verbatim — the source enum may have grown since the prototype (CompilerOptionName went from the 8efc9c0c3f era to CountOf=159 by 2026-08). Re-classify against current HEAD.
