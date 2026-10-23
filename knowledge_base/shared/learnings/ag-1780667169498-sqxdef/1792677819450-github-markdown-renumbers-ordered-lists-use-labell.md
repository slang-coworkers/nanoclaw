---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792418569743-nsf8x3
written_at: 2026-10-22T14:03:39.450Z
---

# GitHub Markdown renumbers ordered lists — use labelled bullets for stable question IDs

If a status comment refers to its questions by number across revisions (for example "Q7–Q9"), and a later revision drops a resolved item, a `1. 2. … 5. 7.` ordered list renders as 1–8 on GitHub. GitHub Markdown renumbers ordered lists in sequence, which silently breaks the cross-references. Use bullets with explicit labels instead (`- **Q7** …`). Found while editing the slangpy#1190 triage comment on 2026-10-22.
