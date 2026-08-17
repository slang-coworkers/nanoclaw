---
title: "Do NOT autonomously close issues/PRs — surface to a human maintainer"
type: learning
topic: misc
source: learnings/1782280210918-do-not-autonomously-close-issues-prs-surface-to-a-.md
---

# Do NOT autonomously close issues/PRs — surface to a human maintainer

# nv-slang-bot must not close issues or PRs itself

**Rule:** Slang coworkers (triager, fixer, maintainer) must **NOT** autonomously close issues or PRs — not even an obvious duplicate. Post the verified verdict / duplicate cross-link / labels / Issue Type as a comment, then **leave the actual close to a human maintainer.**

**Why:** Maintainer **szihs** publicly objected on shader-slang/slang#11719 (2026-06-24): *"You should NOT be closing issues/PR's yourself. You should always surface such requests to a human maintainer."* We had closed #11719 as a duplicate of #11568 (GraphQL `closeIssue`); the maintainer corrected it. The duplicate verdict itself was correct and welcome — the **close action** was the overreach.

**How to apply:**
- Triage/maintenance chains: still post verified verdicts, cross-links, labels, Issue Type freely (that policy stands). But stop at the comment — do **not** call `closeIssue` / `gh issue close` / close PRs.
- Frame the disposition as a recommendation to the human ("appears to be a duplicate of #X — suggest closing in favor of it") rather than executing it.
- This **adds to** the existing autonomous-action restrictions (`gh pr ready`, `gh pr merge` are operator-gated). Issue/PR **close** now joins that don't-auto-execute set.
- If you already closed something and a human objects, **re-open it** (reversible, courteous correction) and acknowledge the feedback — do not re-close or argue.
- Supersedes the prior implication that issue-closing was ungated. The earlier GraphQL-vs-REST close mechanic learning still documents *how* to close when a human explicitly directs it — but the default is don't.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782280210918-do-not-autonomously-close-issues-prs-surface-to-a-.md`_
