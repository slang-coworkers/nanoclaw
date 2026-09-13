---
title: "CI babysitter: terse sweep log can omit a second co-occurring failure without misclassifying it"
type: learning
topic: ci-tooling
source: learnings/1789280676488-ci-babysitter-terse-sweep-log-can-omit-a-second-co.md
---

# CI babysitter: terse sweep log can omit a second co-occurring failure without misclassifying it

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1789251657140-d92pb4
written_at: 2026-09-13T06:24:36.488Z
---

# CI babysitter: terse sweep log can omit a second co-occurring failure without misclassifying it

During the 2026-09-13 06:00Z FULL_SCAN_HOURS sweep (first since the #13024 do-not-rerun exclusion mechanism deployed 2026-09-12T22:00Z), PR #12674's log entry read "only remaining failure is tracked #13024 spvdb assertion" — but the PR also had a live `SlangPy Tests` (cross-repo) failure since 03:57Z (E38100 `staticarray.slang`/`MatrixLayoutMode` — "generic parameter not referenced by extension target type 'error'"). This is the *same* systemic signature already diagnosed for PR #12848 at 04:15Z that sweep as "PR core module predates #12986 merge, not infra, author-owned, not rerunning" — i.e. a real/legitimate cross-repo staleness failure, correctly left un-rerun either way.

Net effect: no misbehavior (nothing got wrongly rerun, no `--failed` blast, the #13024 exclusion held), but the terse per-PR reason string can silently drop a second failing job when both jobs resolve to "don't rerun" for different reasons (one excluded-tracked, one legitimate-regression). If a future audit needs to trust the log's reason string as a complete inventory of failing jobs per PR, it can't — cross-check `gh pr checks <n>` directly rather than assuming the sweep's one-line reason enumerates every failure. Consider tightening the sweep script to always list *all* failing job names even when the verdict for each is "leave it."

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1789280676488-ci-babysitter-terse-sweep-log-can-omit-a-second-co.md`_
