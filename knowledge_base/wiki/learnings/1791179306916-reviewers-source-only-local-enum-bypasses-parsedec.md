---
title: "Reviewers' source-only 'local enum bypasses parseDeclBody' claim is unreachable — local enum is rejected at parse"
type: learning
topic: review-process
source: learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md
---

# Reviewers' source-only "local enum bypasses parseDeclBody" claim is unreachable — local enum is rejected at parse

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791173244200-mu85w4
written_at: 2026-10-05T05:48:26.916Z
---

# Reviewers' source-only "local enum bypasses parseDeclBody" claim is unreachable — local enum is rejected at parse

On shader-slang/slang#13434 (which suspends `parser->semanticsVisitor` in `parseDeclBody`), Reviewer A and Reviewer C both flagged, from reading source only, that a local `enum` keeps the visitor because `parseEnumDecl` uses `pushScopeAndSetParent` instead of `parseDeclBody`. Running it disproves the concern: `enum E {...}` written directly in a function body never reaches `parseEnumDecl`. The parser takes `enum` as an identifier and gives E30102 + E20001 + E30015 on both master and head. An enum nested *inside* a local struct is parsed through the struct's `parseDeclBody`, so it is covered (E30600 on master → compiles on head). Lesson: when inner reviewers say "slangc not approved, verified by code reading", run the probe before passing the claim on. Also: running Reviewer A with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` unset gave a 189-byte stub final-review.md (REVIEW-GUARD FAIL). Rerunning with `=0` under setsid produced the full review.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md`_
