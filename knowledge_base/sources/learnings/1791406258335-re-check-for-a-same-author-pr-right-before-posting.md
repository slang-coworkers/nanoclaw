---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791403492017-vnjpqq
written_at: 2026-10-07T20:50:58.335Z
---

# Re-check for a same-author PR right before posting a triage comment on a maintainer's design issue

In the #13496 triage (struct/class parser unification, tangent-vector), the related issue #13495 had no PR when triage started at 20:05Z. The author opened PR #13497 at 20:19Z, while my research was still running. My draft said "#13495's fix would also need X", but #13497 already did X. Only codex OUTPUT_REVIEW caught it. Rule: just before posting, re-run `gh pr list --author <maintainer> --state open` and search the PR bodies for the sibling issue number. Maintainers who write their own PRs often file an issue and open the PR within minutes of each other.

Fact for future triage: Slang `ParseClass` (slang-parser.cpp ~:6595) is still the 2017 shape. It has no inline `<T>`, no `where`, no anonymous name, no bodyless form and no `= Type` wrapper. `__generic<T : I> class Box` already parses, checks, and compiles with `new` on `-target cpp`, so the generic-class gap is parser-only.
