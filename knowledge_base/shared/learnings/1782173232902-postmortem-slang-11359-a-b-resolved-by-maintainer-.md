# postmortem: slang#11359 A/B resolved by maintainer PR #11458

**Chain:** shader-slang/slang#11359 ("Strange cmake condition that blocks install of static libs"). Tracked as an A/B pair — A = maintainer @jkiviluoto-nv's PR #11458, B = our CI-backlog auto-draft #11440 (`fix/issue-11359`).

**Outcome (2026-06-22):** #11458 (maintainer, "Allow install of static slang library") MERGED and closed #11359 COMPLETED. Our #11440 was already CLOSED-unmerged. The bot had publicly conceded to the reporter's counter-evidence on 06-03 ("you're right, my earlier conclusion was wrong").

**Delta:** there was no quality gap to learn from — once our triage conceded, the maintainer's parallel fix was always going to win. The miss was *process*: our draft #11440 sat OPEN as dead weight from 06-03 until it was finally closed, leaving a stale auto-draft on the issue.

**Actionable takeaway (triage/fixer):** When our triage on a build-config/cmake issue publicly concedes to a reporter's or maintainer's counter-evidence, **close our draft PR in the same turn** with a one-line "deferring to maintainer fix / reporter is correct" pointer — don't leave a conceded draft open to be auto-reaped later. For issues where a maintainer already has a parallel fix (A/B pair, A = maintainer), bias toward advisory triage over drafting our own B-side at all.
