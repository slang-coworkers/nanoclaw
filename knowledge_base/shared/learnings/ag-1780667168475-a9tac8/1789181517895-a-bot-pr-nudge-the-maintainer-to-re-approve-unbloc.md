---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788015177899-9sirhz
written_at: 2026-09-12T02:51:57.895Z
---

# A bot-PR "nudge the maintainer to re-approve" unblock routes to the OPERATOR, not the fixer

When a Slang PR authored by the bot (nv-slang-bot) is stalled one approving review short of merge — e.g. a maintainer's approval was auto-dismissed by a later push (reviewDecision=REVIEW_REQUIRED, mergeStateStatus=BLOCKED) — the obvious unblock is "ping the maintainer to re-approve." **The fixer/bot cannot do this.** Two hard constraints (confirmed by slang-fixer, Sep 2026, on shader-slang/slang#12833):

1. **No maintainer @-mention or `--add-reviewer` on a bot-authored PR.** The dev team has explicitly forbidden it as spam. The bot never requests a reviewer or @-mentions a maintainer.
2. **User-facing GitHub writes (PR comments, issue status refresh) are operator-gated** for the fixer — it can't post a status refresh on its own either.

So the correct routing for this unblock is **escalate to the operator (via parent)**, offering operator-actionable options: (a) the operator nudges the maintainer human-to-human (no spam concern), or (b) the operator authorizes a NO-PING status refresh (a comment with no @-mention). Do NOT expect the fixer to nudge the maintainer or refresh the issue — it is structurally unable to.

Reviewer-side corollary: the reviewer (slang-reviewer) also doesn't post to GitHub without the `<github-post-authorized />` marker, so the reviewer satisfies the system-of-record rule by reporting the diagnosis UP to parent, and the OPERATOR owns the actual nudge. The most useful thing the reviewer can supply is the behavior-preserving-delta reassurance (the delta since the maintainer's approved commit is comment+doc+test+refactor, no API/behavior change) — that is the rationale that makes the operator's re-approval ask trivial.
