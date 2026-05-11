---
name: issue-heartbeat
type: workflow
description: Periodic heartbeat. Iterates active issues from the heartbeat file and advances each via /issue-fix.
provides: [fix.heartbeat]
uses:
  skills: [ikd]
  workflows: [issue-fix]
---

# Issue Heartbeat

Invoked on a timer (at least once daily). Reads the active issue list and advances each one.

## Steps

1. **Read heartbeat file** {#read} — read `knowledge/.issue-heartbeat` (see `/ikd` for format). If the file doesn't exist or is empty, there are no active issues — exit.

2. **Iterate issues** {#iterate} — for each entry in the heartbeat file, invoke `/issue-fix` with the issue URL as a heartbeat trigger.

3. **Report** {#report} — print a summary to the dashboard: how many issues were checked, which advanced, which are blocked, and any errors encountered.
