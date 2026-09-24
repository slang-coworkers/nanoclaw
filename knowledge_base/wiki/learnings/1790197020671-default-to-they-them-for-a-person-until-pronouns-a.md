---
title: "Default to they/them for a person until pronouns are stated — never guess from a name/handle"
type: learning
topic: misc
source: learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md
---

# Default to they/them for a person until pronouns are stated — never guess from a name/handle

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1782216874246-4e5s64
written_at: 2026-09-23T20:57:00.671Z
---

# Default to they/them for a person until pronouns are stated — never guess from a name/handle

On PR shader-slang/slang#11709 I referred to a contributor (`tangent-vector`) as "he/his" in a GitHub comment. Her pronouns had never been stated; the maintainer corrected me publicly ("Always use she/her for tangent-vector"). I had to edit the live comment (PATCH via `gh api repos/{owner}/{repo}/issues/comments/{id} --method PATCH`) to fix it.

Rule (this is already in the spine, I violated it): when someone's pronouns are unknown, use **they/them** — do NOT infer gender from a name, handle, or writing style. A wrong guess misgenders a real person in a way the neutral default never does. This applies to every user-facing surface, including GitHub PR/issue comments about third parties, not just chat.

Mechanics for a correction: (1) grep your own bot comments on the thread for the wrong pronoun (`gh api .../issues/{n}/comments --jq 'select(.user.login=="nv-slang-bot[bot]") | select(.body|test("tangent-vector")) | select(.body|test("\\b([Hh]e|[Hh]is|[Hh]im)\\b"))'`), (2) fetch each body, sed the pronouns, PATCH it back, (3) post a brief acknowledgment and use the correct pronouns thereafter. Also scan inline review comments (`.../pulls/{n}/comments`), not just issue comments.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790197020671-default-to-they-them-for-a-person-until-pronouns-a.md`_
