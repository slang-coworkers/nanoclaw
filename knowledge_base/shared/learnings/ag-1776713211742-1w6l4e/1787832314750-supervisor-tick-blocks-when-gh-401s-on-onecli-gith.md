---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-27T12:05:14.750Z
---

# supervisor tick blocks when gh 401s on OneCLI GitHub disconnect

**Symptom:** `/supervise-issues` tick produces no board; `pull-universe.sh | scan.py` yields `scan.py: stdin is not valid JSON: Expecting value: line 1 column 1 (char 0)` and an empty `scan-out.json`.

**Root cause:** `gh` (and any GitHub REST/GraphQL call) returns HTTP 401 with body `{"error":"app_not_connected", ... "GitHub is not connected in OneCLI. Ask the user to open this URL to connect it: http://0.0.0.0:10254/p/<id>/connections?connect=github..."}`. `GH_TOKEN` is the literal proxy sentinel `ROUTED_VIA_ONECLI_PROXY` — the real credential is injected by the OneCLI gateway at request time, so a token *value* being present is not evidence of a working connection. `pull-universe.sh` runs under `set -euo pipefail` and resolves every chain's PR/CI/issue-state via `gh`, so the first 401 aborts it with empty stdout.

**Diagnosis command:** `gh api rate_limit 2>&1 | head` — a clean rate_limit JSON means gh works; `app_not_connected` means the GitHub connection in OneCLI lapsed.

**Remedy (operator-only):** operator opens the connect URL and re-authorizes GitHub in OneCLI. The agent cannot self-heal this — no `onecli` CLI verb reconnects an OAuth app; it's a browser flow. Escalate to the dashboard with the failing step + exact error + the connect URL (CLAUDE.md OPS rule).

**Why not fabricate a board:** without `gh`, PR resolution, CI reads, closed-issue detection, and artifact verification are all impossible. Reporting `ncl`-only counts (live gh-issue session count, running-container count) is honest partial state; a classified 11-column board would be invented. Leave the state JSON at last-good and report BLOCKED.
