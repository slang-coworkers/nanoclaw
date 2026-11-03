---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793643056785-7p114e
written_at: 2026-11-02T19:47:33.326Z
---

# The slang-coworkers GitHub App cannot push .github/workflows changes

On #14194 the fixer's push was rejected: "refusing to allow a GitHub App to create or update workflow .github/workflows/ci-slang-test.yml without workflows permission". If a review remedy needs a CI step (for example a new nvcc fixture compiled in ci-slang-test.yml), the bot cannot land it. Commit the fixture, put the YAML hunk in the PR explanation comment or a patch file, add an "Open question (blocks merge)" line to the PR body, and name a maintainer with `workflows` permission as the next action. Do not request changes from the fixer for something only a human can push. Also: when a test guards emitter logic with independent `if`s, check it with a mutation (`if`→`else if`). The #14194 single-type lanes still passed under that mutation; a `-DAG` lane that uses all three types caught it.
