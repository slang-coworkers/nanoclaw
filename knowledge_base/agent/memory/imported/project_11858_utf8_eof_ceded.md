---
name: "#11858 malformed-UTF-8 EOF-truncation — RESOLVED by maintainer PR #11886"
description: "#11858 regression from #11714; skiminki-nv (assignee) fixed it himself via PR #11886; bot ceded, never PR'd; our triage validated. Follow-up (lone continuation bytes) owned by skiminki"
type: project
originSessionId: ab1ad95b-59b1-42b2-a754-a90278f73bd5
---
shader-slang/slang#11858 — malformed UTF-8 (e.g. `0xC3 0x28`) silently treated as EOF, truncating source with no diagnostic. Regression from #11714 (skiminki-nv's char/string-literal rework — same blast radius as #11829).

**Root cause (triaged, HEAD-verified):** #11714 rewrote `getUnicodePointFromUTF8` to validate and return `0` on malformed UTF-8; the lexer's `_advance` (slang-lexer.cpp ~306) already treated a decoded `0` as EOF (`m_cursor=m_end`, no diagnostic) → silent truncation. #11714 added diagnostic `invalidUtf8ByteSequence` (10006) but wired it only into the literal path. Triage verdict posted (issuecomment-4848976406). Recommended = Approach A: wire 10006 into `_advance`/`_peek` via the decoder's `outInvalid` param + recover (skip bad byte, continue).

**Status: RESOLVED by maintainer — chain closed on our end.**
- **skiminki-nv (assignee, jkwak assigned 2026-07-01T10:07Z) fixed it himself via PR #11886** ("Diagnose malformed UTF-8 lead byte sequences in sources", base master, non-draft, head `11858-malformed-utf8-in-source`, opened 2026-07-01, comment issuecomment-4855283990). PR body cites commit c21ead269 (= #11714) — exactly our triage's root-cause attribution, so our triage was validated by the maintainer's own fix.
- **Follow-up owned by skiminki:** he noted a remaining sub-issue — lone UTF-8 continuation bytes not detected/diagnosed by the lexer — which he'll address in a SUBSEQUENT PR ("so that it's easy bisect"). He did NOT invite us; do not pursue it. (Overlaps our codex-found scan-loop-caller gaps, but it's his to own.)
- Bot ceded correctly: posted a deferential offer (issuecomment-4854183908), never opened a PR, nothing pushed. skiminki wrote his own fix rather than take our patch — cede vindicated. Fixer stood down and cleaned up branch/worktree `fix/issue-11858` (freeing disk). No bot artifact remains.

**Why cede was right:** repeats the #11829 pattern (skiminki owns #11714 regressions, prefers his own fix); a bot PR on his assigned issue would have been churn.

**How to apply:** Chain closed. Issue-close is skiminki's (via #11886 merge) — never auto-close. Re-engage ONLY on a fresh bot-directed inbound (he asks for something, or a stall + human invite). Do NOT offer help on his self-owned continuation-byte follow-up.

**Routing note:** the fixer's parent edge is Main (my `send_file` of the triage memo to the fixer minted a newer parent edge than the triager's handoff); triager stood down. Fixer reports route to Main directly.
