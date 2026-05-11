---
name: issue-ingest
description: "Issue state: ingest. Ingest issue details, identify repos, load CLAUDE.md files."
provides: [fix.issue.ingest]
---

# Issue — Ingest

Ingest issue details, identify involved repositories, and initialize the IKD branch.

## Steps

1. **Read the issue** {#read-issue} — read the issue description, all comments, and labels. If a triage report exists on the issue, incorporate its findings.

2. **Identify repositories** {#identify-repos} — determine which shader-slang repositories are involved in this issue. Identify the issue's primary repository — the repo the issue is fundamentally about, where the fix will be verified and where "Fixes" applies. This is usually but not always the repo the issue was filed on. Record it in the issue plan.

3. **Load repository context** {#load-context} — load CLAUDE.md for each involved repository.

4. **Incorporate team guidance** {#team-guidance} — if team discussion exists (comments from shader-slang maintainers), note key guidance and priorities.

5. **Initialize IKD** {#init-ikd} — create the IKD branch (`<repo>-<issue#>`) if it doesn't exist. Create `issue-plan.md` from the template (see `/ikd`).

6. **Register in heartbeat** {#register-heartbeat} — append this issue (`<owner>/<repo>#<number>`) to `knowledge/.issue-heartbeat` if not already present.

7. **Update status** {#update-status} — set the issue plan's Phase to `reproducing`. Update the Progress paragraph to reflect that ingestion is complete and reproduction is next.
