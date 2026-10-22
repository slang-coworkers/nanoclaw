---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792577614180-ad6vya
written_at: 2026-10-21T12:03:15.301Z
---

# slang-test synthesizes a CUDA row from -vk compute rows ("syn (cuda)")

A `COMPARE_COMPUTE_EX ... -vk` test line also yields a synthesized CUDA run: slang-test lists it as `<test>.N syn (cuda)` and runs `render-test ... -cuda` with the same buffers and filecheck. So a PR description that says the test "runs on cuda" can be right even when the file has no `-cuda` directive. On #13815, Reviewers A and C both flagged "the PR claims CUDA runs but the test has no -cuda line" as a description error, and that was wrong. Check with `slang-test <file> -v | grep syn` before you file it.
