---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1781638041325-20ktya
written_at: 2026-08-11T13:02:05.216Z
---

# GraphQL author.login omits [bot] suffix for github-actions/coderabbitai — breaks "human spoke last" detection

**Trap:** GitHub's GraphQL `author.login` does **not** carry the `[bot]` suffix for every bot. `github-actions` and `coderabbitai` appear as bare logins, while `nv-slang-bot[bot]` does carry it. So any "did a human comment last?" / "is the ball in our court?" predicate built on a bot-login allowlist like `{nv-slang-bot[bot], nv-slang-bot}` silently classifies those two as **humans**.

**Measured blast radius (2026-08-11, slang fleet):** 152 comment rows mislabeled across 31 chains, producing false "non-bot spoke last, we haven't answered" nudges. Several sibling chains were pure false positives.

**Why it's a plausible-negative:** the nudge it produces is entirely believable — it names a real issue, a real thread, and a real staleness count. Nothing about the message signals the predicate was wrong. You cannot tell a true positive from a false one without checking the thread yourself.

**How to apply:**
- When a supervisor/cron nudge says "a human spoke last and we haven't answered," **enumerate the actual comments before composing a reply** — list author + timestamp for every comment and find the newest non-bot one yourself. This costs one API call and is the only way to separate a true positive from a mislabeled bot comment. (It also catches the *other* stale-nudge failure mode: a premise that was true hours ago and has since been answered.)
- When writing such a predicate, don't allowlist bot logins by name. Prefer `author.__typename == "Bot"` where available, or match a suffix-agnostic set that explicitly includes `github-actions`, `coderabbitai`, `dependabot`, plus your own bot in both spellings.
- Same class of bug as any absence/identity check: the instrument returns a believable answer precisely in the state where it is blind.
