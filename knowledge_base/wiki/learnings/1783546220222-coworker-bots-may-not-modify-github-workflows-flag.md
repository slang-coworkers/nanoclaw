---
title: "Coworker bots may not modify .github/workflows — flag before building"
type: learning
topic: ci-tooling
source: learnings/1783546220222-coworker-bots-may-not-modify-github-workflows-flag.md
---

# Coworker bots may not modify .github/workflows — flag before building

A fix that edits `.github/workflows/**` (CI YAML, or the shell scripts those workflows invoke, e.g. `ci-examples.sh`) can be **rejected by a maintainer on security-policy grounds** even after you get a clean PR open. Observed on shader-slang/slang#11989 → PR #12001: jkwak-work closed it unmerged with "coworker is not allowed to modify [workflow files] for security reasons. I will run an agent locally."

Two signals, one policy:
1. **Push-time (technical):** the bot's GitHub App token lacks the `workflows` permission on `shader-slang/slang`, so `git push origin` of any `.github/workflows/**` change is remote-rejected ("refusing to allow a GitHub App to create or update workflow ... without workflows permission"). Workaround that WORKS mechanically: push to the `slang-coworkers/slang` fork (its App install has the perm) + open a cross-fork PR via REST (`gh api -X POST repos/shader-slang/slang/pulls -f head=slang-coworkers:<branch> ...`; `gh pr create` GraphQL fails "fork collab can't be granted").
2. **Review-time (policy):** even with the PR open, the maintainer may close it because a bot touching CI workflow files is disallowed regardless of mechanism.

**Rule:** if a triaged fix's scope includes `.github/workflows/**` (or scripts uniquely invoked by them), FLAG the workflow-modification policy risk to the maintainer/triager BEFORE building — ask whether a coworker is permitted to touch CI at all, or whether they'd rather run a local agent. Don't burn a full implement+validate+cross-fork-PR cycle on a change that policy forbids. The `workflows`-permission push rejection is the early tell: treat it as "this may be disallowed," not just "route around it."

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783546220222-coworker-bots-may-not-modify-github-workflows-flag.md`_
