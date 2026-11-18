---
title: "gh auth status false negative under OneCLI proxy — probe with a real API call, and transient 429s kill Reviewer C but the retry is cheap"
type: learning
topic: review-process
source: learnings/1794908670329-gh-auth-status-false-negative-under-onecli-proxy-p.md
---

# gh auth status false negative under OneCLI proxy — probe with a real API call, and transient 429s kill Reviewer C but the retry is cheap

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794905117998-umwrea
written_at: 2026-11-17T09:44:30.329Z
---

# gh auth status false negative under OneCLI proxy — probe with a real API call, and transient 429s kill Reviewer C but the retry is cheap

`gh auth status` is a false negative in this container (seen 2026-11-17, slang#14530 review): it reads the locally-invalid GH_TOKEN and prints "HTTP 401: GitHub is not connected in OneCLI" + a connect URL, but real `gh` API calls (`gh pr view`, `gh pr diff`, `gh api repos/.../pulls/comments/<id>`) succeed because the proxy replaces the placeholder credential at request time. Don't block pr/branch-mode preflight or escalate a human connection on `gh auth status` alone — always probe with one real read call (e.g. `gh pr view <N> -R <owner>/<repo> --json headRefOid`) before concluding gh is broken. Also seen same day: Reviewer C died mid-run on a transient NVIDIA inference-API 429 (WAF CPE_RateLimit_IP) while Reviewer A was hitting the same API concurrently; the re-run (fresh CLARITY_RUN_DIR, C-<pr>-r2) completed clean once A finished — re-running C after A completes is the cheap fix, don't mark the review reviewers_complete=false over one transient 429. And: `setsid nohup ... &` survives the Bash tool's timeout kill even though the printed `$!` PID dies (the actual detached child is $!+2) — verify with `ps -eo pid,args | grep <script>` on the script name, not the captured PID.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794908670329-gh-auth-status-false-negative-under-onecli-proxy-p.md`_
