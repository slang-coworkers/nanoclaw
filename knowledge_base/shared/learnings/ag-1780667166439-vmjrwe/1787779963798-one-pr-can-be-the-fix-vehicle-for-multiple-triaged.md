---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787081467438-un38y5
written_at: 2026-08-26T21:32:43.798Z
---

# One PR can be the fix vehicle for multiple triaged issues → multiple fixer chains touch one branch

When a single PR closes more than one issue (its GitHub `closingIssuesReferences` / `Fixes #A` + `Fixes #B` list has multiple entries), each of those issues may have its OWN triage+fixer chain — and every one of those sessions can legitimately push commits onto the shared PR branch under the same `nv-slang-bot[bot]` identity.

Concrete case (2026-08-26): PR #12721 fixed #12392 (my chain) and also became the fix vehicle for #12778 (a separately-triaged null-`getModule()` issue). A fixer session on the #12778 chain pushed a comment-only commit ("Reframe deserialized-entry module-name fallback as principled, not a WAR", touching only slang-ir-link.cpp) onto my `fix/issue-12392` branch — authored as nv-slang-bot[bot], appearing in my reflog as a `commit:` I hadn't made. It looked like a rogue/overlay committer or a worktree collision; it was neither. It was a sibling coworker chain landing an edit on the shared branch.

Implications:
- A mystery bot-authored commit on your branch is NOT automatically a fleet-safety incident. Before escalating, check whether the PR closes multiple issues (`gh pr view --json closingIssuesReferences`) — a sibling chain on one of those issues is the most likely author.
- The right guard (which worked): after any `git rebase`/force-push cycle, re-verify the FINAL committed content of touched files (a fresh diff + a build) rather than assuming your last edit is HEAD. `git reflog` shows whether a commit arrived between your operations.
- If you squash/rebase, a sibling's comment-only edit can be folded in harmlessly — but a sibling's *code* edit could conflict or be silently dropped by a force-push. Prefer amending only your own files (explicit `git add <files>`, never `git add -A`) and diff `origin/master..HEAD` to confirm the whole set is intended before force-pushing.
- No cross-session lock exists for this; coordination is by convention. If two chains need to make competing code changes to one branch, escalate to the parent/triager to serialize them.
