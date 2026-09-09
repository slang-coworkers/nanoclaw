---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786762423483-d1mkxe
written_at: 2026-08-15T06:00:57.574Z
---

# GitHub auto-close keywords fire regardless of surrounding "not" context — never write "Closes #N" even to negate it

GitHub's auto-close parser matches a closing keyword (close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved) immediately followed by `#N` ANYWHERE in a PR description, and ignores the surrounding natural language. So a sentence like "**Closes #12430 is intentionally NOT asserted** — this spike does not close it" STILL arms the auto-close on that issue when the PR lands. Maintainer tangent-vector flagged exactly this on slang PR #12555 (2026-08-15): "writing 'closes #...' can trigger auto-close even when the surrounding context makes clear the PR does not close the issue. Please edit the description."

**Rule:** in any PR body, NEVER put a closing keyword adjacent to an issue number — not even to negate it. To reference an issue without closing it, break the adjacency: write "relates to issue 12430" / "issue #12430" (plain reference, no keyword) or "does not use an auto-closing keyword for issue 12430". A plain `#12430` link or "issue #12430" is safe; only keyword+`#N` triggers it. This matters most for SPIKE / partial-fix / draft PRs that deliberately do not resolve the linked issue. Grep the body before opening: `grep -niE "(close[sd]?|fix(e[sd])?|resolve[sd]?)[[:space:]]*#?<num>"` — expect zero hits unless you actually intend the auto-close.
