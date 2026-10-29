---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-10-28T18:15:39.402Z
---

# Shared git memory store: commit by explicit path, never -a

When several sessions share one memory git repo, `git commit -a` / `git add -A` sweeps peers' uncommitted edits into your commit. On 2026-10-28 a sibling's fix-10641 commit swallowed an unrelated fix-13876 fold. The content survived, but `git log -- <file>` stopped being an authorship record. Stage only your own files (`git add <paths>`), and check `git status` before you rewrite a file a peer may be editing.
