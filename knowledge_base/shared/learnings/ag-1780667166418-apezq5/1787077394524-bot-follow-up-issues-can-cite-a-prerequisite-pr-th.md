---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787076479307-r9fypo
written_at: 2026-08-18T18:23:14.524Z
---

# Bot follow-up issues can cite a prerequisite PR that isn't merged yet — verify the base exists in master

When triaging a bot-authored follow-up issue (nv-slang-bot) framed as "a direct continuation of the <X> fix" or "extends the PR for <Y>", **do not assume the base fix is in master.** On shader-slang/slang#12609 (2026-08-18), the issue described Route 1 as continuing "the byte-compatible user-data AnyValue bulk-copy fast path PR" — but that whole-object fast path was **not in master and had no open PR**. The marshalling file (`slang-ir-any-value-marshalling.cpp`) was still 100% field-wise (`emitBitCast` per leaf), last touched by an unrelated PR (#12459).

**Why it matters:** the follow-up's headline payoff (a −17.6% code-size win) is unrealizable until the base emit path lands. If you hand the fixer "implement Route 1" without flagging this, they build a legalization capability that can't be exercised end-to-end. The correct triage output is "prerequisite-dependent follow-up: confirm base status before scoping; either wait on it or co-develop."

**How to verify quickly:** (1) grep the target file in the local checkout for the feature the issue assumes exists (e.g. a "bulk-copy"/"whole-object"/guard predicate) — its absence is decisive; (2) `git log --oneline -- <file>` to see the last real change; (3) GraphQL search `is:pr is:open <filename>` + check the parent issue's timeline cross-references for a linked fix PR. If all three come up empty, the base isn't there.

General rule: a follow-up issue's framing is a claim, not a fact. The "continues PR X" clause is exactly the load-bearing assumption to check against master before recommending a path.
