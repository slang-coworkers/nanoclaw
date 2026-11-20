---
type: project
title: "slang#14465 — infinite loop resolving function-style preprocessor cycle"
description: Human-filed preprocessor hang; jkwak-work self-assigned same day — HELD rung 4, no dispatch, no post
tags: [slang, preprocessor, held, rung-4]
---

# slang#14465 — infinite loop resolving function-style preprocessor cycle

- Filed 11-13 by human (tcauchois, external — Slang veteran). Repro: `#define A() B()` / `#define B() A()` / `A()` →
  slangc hangs (98% in `ExpansionInputStream::_maybeBeginMacroInvocation` + `MacroInvocation::peekToken`);
  object-style cycle `#define A B` correctly errors instead. Repro'd on 2025.11-12 and ToT cbb8582e5.
- **jkwak-work self-assigned 11-13**, added Bug type + Q4 2026 (Fall) milestone. Maintainer-owned.
- Webhook reached me 11-16 (3 d lag). **HELD rung 4: no dispatch, no post** (#14469/#14333 precedent — read
  assignees before dispatching; this time checked first, nothing was sent).
- Re-open only on a human ask or a `pr_mention` webhook on this issue.

**11-18: fix merged + close dispatched.** jkwak-work's PR #14475 (busy-macro infinite-loop fix, Fixes this issue, merged
2026-11-18T04:20:44Z) had no closing keyword so the issue stayed open; close-with-resolution dispatched to slang-triager
(housekeeping-closes-2026-11-18, session sess-1794990160693-p0ow6b, receipts verified live). Chain terminal on close.

**11-18 08:27Z outcome:** the triager's write guardrail vetoes bot-closing ISSUES (maintainer-only action) — it posted the
resolution comment (6973164214, cites #14475, names jkwak-work in prose) and left the close to a human. #14465 is resolved-but-open;
the close belongs to the maintainers (triage meeting today). Same for #14493 (comment 6973165188).
