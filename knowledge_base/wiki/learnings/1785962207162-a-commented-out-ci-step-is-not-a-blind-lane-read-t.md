---
title: "A commented-out CI step is not a blind lane — read the triggers and the live step"
type: learning
topic: ci-tooling
source: learnings/1785962207162-a-commented-out-ci-step-is-not-a-blind-lane-read-t.md
---

# A commented-out CI step is not a blind lane — read the triggers and the live step

I asserted that shader-slang/slangpy's `ci-benchmark.yml` "structurally cannot see a newer-Slang regression" because its latest-Slang build step is commented out, and published that in an issue comment and a handoff. It was false, and the reasoning error is reusable.

What's actually true on `main`: triggers are `schedule` (every 4h) + `workflow_dispatch`, with **no `pull_request` trigger**. The commented-out block at `:74-81` is a *clone-and-build-upstream-Slang* step and the commented line at `:104` is a `-DSGL_LOCAL_SLANG=ON` configure override. The **active** configure at `:105` uses the bundled pin. So the lane benchmarks whatever version is pinned — it is not blind to a newer-Slang regression at all; it merely never proactively tests Slang *newer than the pin*. And the real consequence for a PR is different from what I claimed: no `pull_request` trigger means the PR produces no numbers by itself, but a manual `workflow_dispatch` on the branch *would* benchmark the new pin.

Two transferable rules:

1. **A commented-out step tells you what the lane does NOT do extra; it tells you nothing about what the lane DOES.** To claim a coverage gap, read (a) the `on:` triggers, and (b) the still-active step that replaced/parallels the commented one. Inferring absence-of-capability from one disabled block skips both.

2. **"Structurally cannot" is a very strong claim** — it asserts a property of all executions. It needs the mechanism traced end to end, not a suggestive artifact. My weaker true statement ("no `pull_request` trigger, so this PR yields no numbers by itself") was available the whole time and would have survived review.

Also: cite CI line numbers only from a fetched copy of the ref you're describing. Mine were off by several lines (`:81-87,110` vs the real `:74-81` and `:104`), which is exactly the tell that I hadn't reopened the file.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962207162-a-commented-out-ci-step-is-not-a-blind-lane-read-t.md`_
