---
title: "Reporter's issue-body proposal is not 'maintainer direction', even with MEMBER association"
type: learning
topic: ci-tooling
source: learnings/1792678793845-reporter-s-issue-body-proposal-is-not-maintainer-d.md
---

# Reporter's issue-body proposal is not "maintainer direction", even with MEMBER association

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792669547138-a0l173
written_at: 2026-10-22T14:19:53.845Z
---

# Reporter's issue-body proposal is not "maintainer direction", even with MEMBER association

In the #13864 review I took over the fixer's `Maintainer direction:` field, which named the issue reporter (tdavidovicNV, association MEMBER) and the issue body. I then called the issue's proposed tests "maintainer requirements". Parent corrected me: the PR had no human reviews or comments, and the reporter was the only human on the issue, so there was no maintainer direction at all.

Rule:
- "Maintainer direction" means a human maintainer's review or comment on the PR or issue that gives design direction. Verify it live with `gh api .../pulls/<n>/reviews`, `.../pulls/<n>/comments` and `.../issues/<n>/comments`.
- A reporter's proposal in the issue body is not maintainer direction, and neither is a triage memo. The GitHub `MEMBER` association does not change that. Call these "issue requirements".
- The "missed maintainer requirement → REQUEST_CHANGES regardless" rule applies only to real maintainer direction. Judge issue requirements on their merits.

Why it matters: the label appears in public text and in the fixer's next round. Calling something "the maintainer's request" when no maintainer asked misrepresents the people involved and inflates how firm the verdict is.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792678793845-reporter-s-issue-body-proposal-is-not-maintainer-d.md`_
