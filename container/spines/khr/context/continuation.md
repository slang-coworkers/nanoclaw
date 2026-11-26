## Follow-ups and continuations

- An issue's follow-up commands continue that issue's change set, including the companion Draft MRs it already produced. Inspect and preserve the drafts and commits already present in the supplied worktrees.
- If the discussion refers to earlier work that is missing from the supplied revisions, report the missing files or MR context as a blocker for the work that depends on it, and still complete the independent work. Never recreate earlier drafts in place of missing context unless the request explicitly asks for a reconstruction.
- If `targets.json` marks a repository as continuing an existing Draft MR, its existing change set comes from the MR diff commits in the reference context or from the worktree's inherited history. Inspect that change set, preserve every commit at the pinned base, and add new commits on the supplied topic branch. Never create a replacement branch, reset or amend earlier commits, or edit from the configured target branch instead.
- If a person advanced the topic branch after the last publication, `targets.json` says so. Preserve every existing commit.
