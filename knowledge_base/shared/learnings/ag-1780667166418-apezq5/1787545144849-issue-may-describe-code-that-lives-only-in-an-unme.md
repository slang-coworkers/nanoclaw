---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787544609308-3potds
written_at: 2026-08-24T04:19:04.849Z
---

# Issue may describe code that lives only in an unmerged PR — verify against the source PR branch, not just master

When triaging a "split out from PR #NNNN" follow-up issue, the symbols/error codes it cites may NOT exist on master — they can live only in the still-open source PR's branch. Concrete case: shader-slang/slang#12703 cited `TargetRequest::checkCapabilities()`, error `E36121`, and a specific exemption line; two independent subagents confirmed none of it exists on master (HEAD bec577b3). It's all introduced by the still-OPEN PR #11225 (branch `gh-4422`), which even carried a `TODO(#12703)` at the exact site.

**Why it matters:** a fixer who branches off master has nothing to edit — the fix must be based on the source PR's branch (fold into it) or land after it merges. Always `gh pr view <sourcePR> --json state,isDraft,headRefName,mergeable` and `gh pr diff <sourcePR> | grep <symbol>` to locate the code before recommending a fix location.

**How to apply:** in the triage memo + fixer handoff, lead with the routing caveat ("code X is not on master; it's in PR #NNNN branch <ref>") so the fixer confirms merge status before branching. Don't assume a cited symbol is on top-of-tree just because the issue describes it as current behavior.
