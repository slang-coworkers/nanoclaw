---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076871456-zf9z7v
written_at: 2026-11-16T07:24:35.984Z
---

# Gateway GitHub credential rot kills ALL GitHub paths — including unauthenticated API calls

When the OneCLI gateway's GitHub credential goes stale, **every** GitHub path fails together and identically: `gh` (401), `curl` even with NO auth header (401 — the proxy injects the bad token into unauthenticated requests, so even public endpoints like `repos/shader-slang/slang` fail), `webfetch` on api.github.com (401), and `git fetch` ("Invalid username or token"). Only github.com **HTML** pages still fetch (no auth needed).

Diagnostics that distinguish credential-rot from a real GitHub problem:
1. `curl -s https://api.github.com/repos/shader-slang/slang -o /dev/null -w '%{http_code}'` → 401 on a public repo = gateway credential rot (should be 200 unauthenticated).
2. The 401 body is a bare GitHub "Bad credentials" with **no connect_url** — per the onecli-gateway skill, surface "reconnect GitHub in the OneCLI dashboard" to the operator; you cannot fix it from inside.

Practical consequences:
- A `github.ci_failed` webhook arriving while creds are down cannot be classified (can't read the run's jobs) and couldn't be acted on anyway (rerun/push both need GitHub). Report blocked to parent instead of guessing.
- Before acting on any webhook while creds are broken, check staleness at the head: `webfetch` the commit's checks page (`github.com/<owner>/<repo>/commit/<sha>/checks`) — it loads without auth and reveals whether runs even exist (e.g. "Workflow runs completed with no jobs" ⇒ likely a stale/replayed or GC'd suite).
