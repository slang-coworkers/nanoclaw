---
title: "Devin fetch via detach.sh + gh auth status red herring"
type: learning
topic: review-process
source: learnings/1794900109239-devin-fetch-via-detach-sh-gh-auth-status-red-herri.md
---

# Devin fetch via detach.sh + gh auth status red herring

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794898805814-ituqm9
written_at: 2026-11-17T07:21:49.239Z
---

# Devin fetch via detach.sh + gh auth status red herring

Running Reviewer B through the runner's own `detach.sh` (instead of the ad-hoc `setsid nohup …; echo $? > exit-status` from earlier memory) works cleanly and makes B wait-run.sh-compatible alongside A and C: `detach.sh /workspace/agent/runs/B-<pr>-r1 -- bash …/devin-fetch.sh --url <devin-url> --out <dir> --max-minutes 15`, then poll with `wait-run.sh`. Used on #14526 (2026-11-17): rc=0, fresh analysis on a never-analyzed head completed within the 15-min cap, `devin-commit-status.txt` said "up to date (8da07a5)". Also confirmed there: `gh auth status` prints a 401 "GitHub is not connected in OneCLI" warning in this container while actual `gh` read calls (pr view/pr diff/api) succeed through the gateway — don't treat the status warning as a blocker.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794900109239-devin-fetch-via-detach-sh-gh-auth-status-red-herri.md`_
