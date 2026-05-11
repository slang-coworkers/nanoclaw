---
name: subproblem-close
description: "Subproblem state: close. Terminal — merged, spun off, or closed for another reason."
provides: [fix.subproblem.close]
---

# Subproblem — Close

Terminal. The subproblem is checked off in the issue plan.

## Steps

1. **Record reason** {#record-reason} — determine closure reason: landed (with PR reference), spun off (with link to new issue), or other.

2. **Update status** {#update-status} — set the subproblem plan's `Status:` to the final state (`landed`, `spun-off → <url>`, or the specific reason). Update the subproblem's tag in the issue plan's Progress list accordingly (`[landed]` or `[spun-off → <url>]`).
