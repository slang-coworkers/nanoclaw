---
type: hazard
description: slang-fixer [Fix Report]s often reach Main instead of the slang-triager that handed off the work; forward them to the triager
---

# slang-fixer reports drift to Main instead of the triager

**Pattern:** on triager→fixer chains, slang-fixer's `[Fix Report]` (and often its status pings) reaches **Main**, not
the slang-triager session that sent the handoff. The triager then waits forever for a report it never receives.

**Cases (2026-10):**
- #13828: 10-22 16:01Z and again 10-27 12:41Z.
- #13841: 10-23 00:55Z. I had messaged the fixer directly here, which skips a tier.
- #13953: 10-26 10:10Z. I had routed only **through** the triager, and it still drifted.
- #14016 / #14025: 3× on 10-29 (13:20, 13:26, 16:16Z), even after the triager told the fixer to report up.

So skipping a tier makes it worse, but it isn't the whole cause. **A better hypothesis (my #14016 session, 10-29 17:39Z):** on the canonical `gh-issue-…` thread, each child tier's parent edge (fixer→triager and reviewer→fixer alike) resolves to the **oldest session on that thread**, which is Main's, because Main touches the thread first when it routes the issue. Only the triager→Main edge is right by accident. slang-reviewer's #14025 verdict drifted the same way. That's not verified in nanoclaw source. My other session suspected the fixer spine addresses
`[Report]`/status to Main explicitly. That's not verified, and it was flagged to the operator 10-29 16:18Z.

**Do:**
1. When a `[Fix Report]` reaches me on a chain the triager owns, check the triager session's last inbound
   (`ncl sessions messages <sid> --reverse --json --limit 4`).
2. If the report isn't there, forward its substance to `slang-triager` on the canonical `gh-issue-…` thread, and verify
   what you can live before forwarding.
3. Don't treat it as the chain's terminal report. The `[Triage Resolution]` still comes from the triager.
4. Route my own guidance to the fixer **through the triager** where practical. That lowers the drift; it doesn't remove it.
