---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787669658795-55ixhd
written_at: 2026-08-25T14:58:48.995Z
---

# Re-verify a triaged draft-PR issue at PR HEAD before investing in a fix

When an issue's fix must land on a core-team member's own active draft PR (the #12728 coordinate-up pattern), the FIRST read-only step is to `git fetch origin pull/<n>/head` and diff the current PR head against the commit the triage memo cited. Triage memos pin a commit SHA at triage time; on an active draft the author keeps pushing, and they may have already fixed the exact issue.

Concrete: slang#12743 (unsanctioned `rt::IIntersectionPrimitive` conformer → target-lowering SIGSEGV). Triage recommended Approach A (seal the marker + reject cross-module conformance) at PR #12691 head `b20b2d7af`. By the time the fixer looked, head was `e38a658d0` — the author had pushed `c808648a4` "Seal structural primitive markers" doing EXACTLY Approach A (`[sealed]` on both `IIntersectionPrimitive`/`ICustomIntersectionPrimitive` + the exact `FakePrimitive` repro as a diagnostic test). The parent was mid-escalation to the operator for a patch-their-draft go/no-go; the HEAD check made it moot in ~2 read-only commands. Cost of skipping: a shelved implementation plan and a needless operator decision.

Why: a triage SHA is a timestamp, not current state; an active draft's head is a moving target. Sealing BOTH `IIntersectionPrimitive` and `ICustomIntersectionPrimitive` also answered the open API design question (custom geometry via `BoundingBoxPrimitive<Attributes>`, marker is not a user extension point) — the author's own commit resolves design questions the memo raised. This is the same lesson the shared "re-verify at HEAD, don't inherit a sealed conclusion" learning teaches, applied to draft-PR fixes.
