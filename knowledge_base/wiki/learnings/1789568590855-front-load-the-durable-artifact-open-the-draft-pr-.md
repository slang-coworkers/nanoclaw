---
title: "Front-load the durable artifact: open the (draft) PR before the fragile rebase/CI tail on long-build repos"
type: learning
topic: ci-tooling
source: learnings/1789568590855-front-load-the-durable-artifact-open-the-draft-pr-.md
---

# Front-load the durable artifact: open the (draft) PR before the fragile rebase/CI tail on long-build repos

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787145209002-vipkk6
written_at: 2026-09-16T14:23:10.855Z
---

# Front-load the durable artifact: open the (draft) PR before the fragile rebase/CI tail on long-build repos

**Confirmed working on shader-slang/slang#12619 (Aug–Sep 2026).** A code-complete CUDA fix took ~1 month and multiple silent stalls to reach a PR, entirely because the fixer's *session* kept dying before finishing the multi-step completion tail — not because of any code problem:

1. **Build-kill across restarts:** the ~611-step ninja build was killed by container restarts on 3 consecutive days before `git push` could run → branch 404'd for days. (In-turn builds survive; across-session background builds do not.)
2. **Session-end before PR-create:** once the push finally succeeded (Aug 21), the session ended right after `git push`, *before* `gh pr create` ran. Branch existed, but **no PR for 11 more days** — nothing resumed to open it. The reporter had to chase twice ("did you implement the fix PR?").

**The detector:** a code-complete fix with a *pushed branch but no PR* after a session is the tell that the session died mid-tail. GitHub ground truth (`gh pr view`, branch existence) beats any relayed "PR #X opened" claim — this same chain also produced a fully *fabricated* PR number earlier, so verify, never relay.

**The fix that worked (credited by the triager as breaking the loop):** **front-load the durable artifact.** Open the (draft) PR from the *current* branch FIRST — GitHub opens a PR fine from a branch far behind master (it just shows "behind") — with `Closes #<n>`, `report_pr_created`, and the rolled-up 5-bullet in the body. That locks in a real clickable artifact *this session* and survives a premature session-end. **Then** do the fragile tail (rebase onto master, run regression, wait on CI) iterating on the PR branch, where the work is durable and CI runs on every push. Same end state, but the PR exists *before* the fragile part instead of after it.

**Generalizes to:** any long-build repo where a worker session may not survive long enough to complete push → rebase → PR-create → CI in one turn. Order the workflow so the durable, resumable artifact (the PR) is created earliest, not last.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789568590855-front-load-the-durable-artifact-open-the-draft-pr-.md`_
