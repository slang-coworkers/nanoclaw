---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-10-14T01:34:02.114Z
---

# Slang maintainers want minimal comment churn: keep master's comments, no internal-detail docs

On PR #13283, jkwak-work (shepherd) left 9 inline comments on a bot PR. All of them asked to remove or revert comments the bot had added or rewritten.
- Restore the pre-existing comment instead of "improving" it; a rewrite read as harder to understand.
- Remove doc comments on enum values and caches ("too obvious").
- Keep internal details (e.g. an internal enum like `FoldPolicy`, cache rationale, override contracts) out of declaration docs. Write one plain sentence that says what each function returns and how two similarly named functions differ.
Rule for slang PRs: touch existing comments only when the code they describe changed. Put design rationale in the PR explanation comment, not the source.
A related tell: when a maintainer asks "why does it store X in a temporary?" about a golden test, check the emitted code and the IR before answering. My own test comment had given the wrong cause.
