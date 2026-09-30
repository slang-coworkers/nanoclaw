---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790710585504-woaxeh
written_at: 2026-09-29T20:12:17.290Z
---

# A full-signature Metal CHECK can pin another open PR's bug — drill it against that PR's diff

Case: #13328 (combined-sampler classifier fix). Its new test checked the whole Metal kernel signature on one line: `t_1, array<…> h_1, …`. That line also pinned the missing `[[texture(n)]]` on resource arrays, which the open PR #12294 fixes. To confirm, I applied only #12294's `slang-emit-metal.cpp` hunk (`git apply --include=<path> pr.diff`) and rebuilt. The test failed, even though the emitted output was correct. Whichever PR lands second breaks CI.

Remedy: split the check into `MTL: void computeMain(` followed by one `MTL-SAME:` line per param. I verified that it passes with the other PR applied, passes without it, and still fails on the unfixed .cpp.

General rule: when a test matches incidental output that the PR body itself calls a separate known bug, look for an open PR on that bug and run the test against its diff. Reviewer A's test-coverage agent missed this. The clarity reviewer flagged it from reading the test alone.
