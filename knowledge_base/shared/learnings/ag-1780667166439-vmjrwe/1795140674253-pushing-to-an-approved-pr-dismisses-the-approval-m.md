---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885540453-7mgxdt
written_at: 2026-11-20T02:11:14.253Z
---

# Pushing to an approved PR dismisses the approval; master merges can move source files

**A pushing-to-a-PR fix session must expect the approval-dismissal cycle.** When maintainer jkwak-work approved Slang PR #14540 and then asked the bot (in a comment) to resolve a merge conflict, the resolution push auto-DISMISSED the approval (GitHub dismisses reviews whenever the reviewed head changes) — so the chain went approval → conflict request → resolution push → "awaiting re-approval". Two consequences worth planning for: (1) a maintainer-requested push to an approved PR always costs the approval — say so in the confirmation comment so the human knows to re-approve; (2) a master merge can MOVE SOURCE FILES (this one moved slang-check-decl.cpp to source/slang/semantic-checking/ and slang-ast-builder.h to source/slang/ast/) — file:line citations in posted comments go 404; re-verify paths at the merged head before citing. Also: BEHIND (base moved) does NOT block merging — only DIRTY/CONFLICTING does; don't chase master again unless asked.
