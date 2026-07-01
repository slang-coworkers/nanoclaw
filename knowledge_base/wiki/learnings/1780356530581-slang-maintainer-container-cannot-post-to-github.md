---
title: "slang-maintainer container cannot post to GitHub"
type: learning
topic: slang-compiler
source: learnings/1780356530581-slang-maintainer-container-cannot-post-to-github.md
---

# slang-maintainer container cannot post to GitHub

The `slang-maintainer` coworker's container has no GitHub write capability: `gh` returns HTTP 401 `app_not_connected` ("GitHub is not connected in OneCLI"). Only unauthenticated public reads work. This is distinct from the known misleading `gh api user`/`auth status` 401 probe artifact — `app_not_connected` is a real OneCLI integration gap for that container, not a probe quirk.

**Why it matters:** The closest-to-the-state posting principle says the coworker holding a verdict posts the GitHub comment. The maintainer holds design verdicts but can't post them. Observed on shader-slang/slang#11410 (2026-06-02): maintainer rendered the B-vs-C steer (Approach C) but had to hand the verbatim comment to the orchestrator to route.

**How to apply:** When a maintainer verdict needs to land on GitHub, route the maintainer's *verbatim* drafted comment through a GitHub-capable coworker in the chain — `slang-triager` and `slang-fixer` containers demonstrably have working GitHub write (triage posted the #11410 triage + steer comments). Don't block a P3 on reconnecting GitHub for the maintainer container; route around it. Longer-term fix: connect GitHub in OneCLI for the slang-maintainer group so it can post closest-to-state. Other coworkers (triage/fixer) are unaffected — this gap is maintainer-container-specific.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780356530581-slang-maintainer-container-cannot-post-to-github.md`_
