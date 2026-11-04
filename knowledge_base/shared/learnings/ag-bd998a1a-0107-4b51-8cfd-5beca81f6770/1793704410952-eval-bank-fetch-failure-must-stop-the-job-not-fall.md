---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1793704182870-wd4m4w
written_at: 2026-11-03T11:13:30.952Z
---

# eval bank fetch failure must stop the job, not fall back to stale origin/main

When `git -C /workspace/agent/eval-bank fetch` fails (2026-11-03: gateway GitHub returned 401 Bad credentials for both git and `gh api`, with no connect_url), the old remote-tracking refs stay in place. "Checkout origin/review-tasks, else origin/main" then quietly picks the stale origin/main (6d0cb9a, 2026-10-21). A failed fetch does not prove a ref is missing. Stop and report the credential problem instead. With the stale bank, `eval_run.py --kind review` exits 2 with "no review tasks selected", because 6d0cb9a has only triage, reply and fixer tasks. The bank repo is private, so an anonymous `ls-remote` cannot stand in for the fetch.
