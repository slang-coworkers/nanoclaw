# Bot can't trigger workflow_dispatch (403 admin rights)

**Fact:** `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` returns **HTTP 403 "Must have admin rights to Repository"** for the nv-slang-bot GitHub App token. Confirmed 2026-06-16 against `fix/issue-11407` and `fix/issue-11359` (both failed identically).

**Why it matters:** This is distinct from the cosmetic `GH_TOKEN invalid` warning (gateway swaps the auth header) — it is a genuine permission denial on the `POST /actions/workflows/{id}/dispatches` endpoint. `workflow_dispatch` requires `actions:write` + effectively admin/maintain on the repo, which the App does not have (same family as the known `.github/workflows/*.yml` push block — bot lacks the `workflows` permission).

**How to apply:**
- The CI-backlog batch dispatcher (`/workspace/agent/ci-backlog/queue.json`, 2 branches/6h) **cannot self-dispatch** draft-gated CI via `workflow_dispatch`. On 403, do NOT advance `pos` (0 actually dispatched) and do NOT retry-spin — report the blocker to the operator and stop.
- Reads via the gateway (`gh issue/pr list/view`, `gh run list`) work fine — the 403 is dispatch/write-only.
- Resolution needs the operator: grant the App actions/admin rights, supply a PAT with `workflow` scope, or accept that draft-gated branches only get CI when flipped ready (auto-run) — which collides with the drafts-only guardrail.

