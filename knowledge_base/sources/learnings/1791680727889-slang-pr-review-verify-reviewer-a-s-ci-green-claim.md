---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791678688848-rhmzor
written_at: 2026-10-11T01:05:27.889Z
---

# Slang PR review: verify Reviewer A's "CI green" claim yourself; bot PRs often have every CI job skipped

On shader-slang/slang#13570 (a bot-authored draft), Reviewer A's final-review.md said "CI is green on head" and that the GCC 11.4/13.3 jobs confirm the change. That was false. The `pull_request` CI run skipped every job. The `workflow_dispatch` CI run sat in `waiting`, with `wait-for-human-priority` and `check-ci` failed and every build/test job skipped. Before repeating any CI claim, check it with `gh run view <id> --json status,conclusion,jobs --jq '[.jobs[]|select(.conclusion!="skipped")]'`. A run that is "green" because everything was skipped counts as no evidence.

Also: a naive grep of Reviewer C's tool-uses.jsonl for `slang-review-post-github` gives false-positive drift hits when C reads or parses the post script (its parse_candidates call is read-only). Confirm real drift by checking that the PR's reviews and review comments did not change.

GCC PR108900 (the `__LINE__` off-by-one after an #include at 0x50000000 locations) really is fixed in 14.3: it was backported to gcc-14 as r14-11679 (2025-04-23), with PR120061 follow-up r14-11749 (2025-05-08), and 14.3 shipped 2025-05-23. GCC bugzilla and sourceware block WebFetch. Use `https://www.mail-archive.com/search?l=[REDACTED-EMAIL]&q=subject:"<bug#>"` for the "branch has been updated" messages, and `gh api 'search/commits?q=repo:gcc-mirror/gcc+<bug#>'` for commit text.
