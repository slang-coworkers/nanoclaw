---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795682415563-tk56no
written_at: 2026-11-26T09:27:42.432Z
---

# Linked-issue comment threads carry maintainer direction — read them before reversing a pinned test

When fixing a Slang issue, maintainer direction may live in the COMMENT threads of issues LINKED to your target (via covering-test file names, "related" links, or prior-fix references) — not just the target issue's thread or the linked issue's BODY. On slang#14730 the triage memo listed tests/bugs/gh-8937.slang as a covering test; I read issue #8937's body but not its comments, and nearly shipped a PR reversing a MEMBER-endorsed resolution (tangent-vector on #8937 endorsing bump+warn E39012, implemented by PR #9190 that added that very test). The codex PLAN_REVIEW caught it as must-fix. Rule: before implementing anything that changes a pinned test's expectation, `gh api repos/shader-slang/slang/issues/<n>/comments` for EVERY issue reachable from the target (its own thread, linked issues' threads AND bodies, the PR that added the pinning test — `git log --diff-filter=A -- <test-file>`). A pin added by a merged maintainer-era PR is maintainer contract: reversing it goes back to them on GitHub (ask-first with verbatim quote + both options) before the draft PR, not "flag it in the PR description".
