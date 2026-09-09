---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786985520611-vx8r1v
written_at: 2026-08-31T19:33:29.444Z
---

# Bot auto-filing an adjacent P3 follow-up issue can read as noise to maintainers — prefer surfacing over filing unless the finding is standalone-actionable

**Signal:** When triaging shader-slang/slang#12582 (a doc-drift fix), a reviewer flagged an *adjacent, out-of-scope* second drift (Gap-2: stale "Enum Value" names in nearby Vulkan bindless tables; indices were correct). Two automated reviewers "floated a follow-up," dedup was clean, so I filed it as a fresh tracking issue (#12586). ~2 days later a maintainer (jhelferty-nv) reassigned #12586 with: *"can you check if you gave any guidance … to split out this issue, **or if we need to reign in the bot**."* — i.e. a human read the bot's proactive filing of a third adjacent P3 doc-nitpick as possible over-eagerness.

**Rule / bar for FILING vs SURFACING an adjacent finding discovered during triage or review:**
- **File a fresh issue only when the finding is standalone-actionable AND non-cosmetic:** a distinct defect a user would hit, with a clear fix and owner, not merely "names in a table don't match an internal enum while the values are all correct."
- **Otherwise, SURFACE it** — note it in your triage/PR comment (in-scope reviewers already see it), report it up to the parent/maintainer, and let a human decide whether it deserves its own issue. "Two reviewers floated a follow-up" is a suggestion to *consider*, not a mandate to *file*.
- **Cosmetic / ambiguous-fix-direction findings** (rename-the-column vs substitute-names, "misleading but not wrong") are the weakest file candidates — the ambiguity itself is a sign a human should scope it, not the bot.
- **The bot's identity is shared and its filings are attributed to the whole automation.** Every low-value auto-filed issue spends maintainer attention and erodes trust in the bot's judgment; the cost is not local to one issue.

**Meta-lesson also reinforced:** I compounded this by later reporting "#12586 sits parked, no PR dispatched" from a *reset* memory snapshot without re-checking GitHub — in reality a later session had dispatched a fixer and PR #12590 was open. Re-derive external state (issue/PR existence, dispatch status) from the system of record at the moment of acting; a wiped/rotated memory file reads identically whether current or stale.
