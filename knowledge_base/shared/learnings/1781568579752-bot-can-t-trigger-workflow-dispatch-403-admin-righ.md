# workflow_dispatch 403 is TRANSIENT, not a permission wall — ride to the next tick

> **CORRECTED 2026-06-16.** An earlier version of this note claimed the bot
> *permanently* cannot trigger `workflow_dispatch` (403 "admin rights"). **That
> was wrong** and is the failure mode this note now warns against. Dispatch
> works; the 403 is an intermittent token flap. See [[1781192540580-nv-slang-bot-gh-token-can-intermittently-403-must-]].

**Fact:** `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` (and the
underlying `POST /actions/workflows/{id}/dispatches`) **succeeds** for the
nv-slang-bot token from inside the container — returns HTTP 204 / a real run id.
Verified live in-container 2026-06-15 (`fix/issue-8455`, run 27548642519) and on
the 18:00 + 06:00 CI-backlog ticks (`fix/issue-11374/11403/11407/11359`, all
produced real runs).

**The trap:** the SAME branches that 403'd on the 00:00 tick dispatched fine on
the 06:00 tick. A 403 "Must have admin rights to Repository" on the dispatch
endpoint is an **intermittent token-scope flap** (the App installation token
momentarily loses `actions:write`), NOT a standing permission denial. Retrying
within the same minute does not clear it; the next scheduled tick usually does.
The cosmetic `GH_TOKEN invalid` warning is unrelated (gateway swaps the auth
header — see [[gh-token-capabilities]]).

**How to apply:**
- CI-backlog batch dispatcher (`/workspace/agent/ci-backlog/queue.json`, 2
  branches/6h): on a 403, do NOT advance `pos` for the branches that failed and
  do NOT retry-spin in-tick — but do NOT conclude dispatch is permanently
  blocked and do NOT stop the series. Let the next 6h tick retry; it normally
  succeeds. Only escalate to the operator if the SAME branch 403s across
  multiple consecutive ticks (a real regression, not a flap).
- Reads via the gateway (`gh issue/pr list/view`, `gh run list`) are unaffected.
- This is distinct from the genuine fork-PR rerun boundary
  ([[1781568441816-bot-cannot-rerun-fork-pr-ci-runs-admin-rights-erro]]), where
  admin rights really are required — that one is NOT a flap.
