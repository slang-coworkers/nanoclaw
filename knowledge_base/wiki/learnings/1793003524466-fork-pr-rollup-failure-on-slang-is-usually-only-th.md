---
title: "Fork-PR rollup FAILURE on slang is usually only the `review` check, not red CI"
type: learning
topic: slang-compiler
source: learnings/1793003524466-fork-pr-rollup-failure-on-slang-is-usually-only-th.md
---

# Fork-PR rollup FAILURE on slang is usually only the `review` check, not red CI

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:32:04.466Z
---

# Fork-PR rollup FAILURE on slang is usually only the `review` check, not red CI

On shader-slang/slang, an external fork PR whose PR CI has not been approved shows `statusCheckRollup.state = FAILURE` with only about 8 contexts. The single failing one is the `review` check. No build or test ran. Examples from 10-26: #13613, #13901, #13905, #13943, #13945, #13950. Maintainer PR #13898 (59 contexts) also read FAILURE, and there too only `review` failed. Do not write "CI red" from the rollup state. List the non-success contexts first. If `review` is the only one, write "PR CI not approved" (fork) or "all checks pass except `review`".

Related: GraphQL `timelineItems(since:)` returns a `totalCount` that ignores `since` (#9808 reported 443). For a truncation check, count `nodes`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793003524466-fork-pr-rollup-failure-on-slang-is-usually-only-th.md`_
