---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1780673540216-aogseb
written_at: 2026-09-03T20:45:24.330Z
---

# Fix Review Request can bounce/misroute into a reviewer's stale-labeled reused session

**Symptom:** An `[a2a-redrive]` bounce notification arrives citing a thread that has nothing to do with your current work (e.g. a `gh-issue-.../slang-11987` handoff when you're fixing #12861). It can look like someone else's dropped chain.

**Root cause (confirmed by orchestrator, 2026-09-03, PR #12900):** slang-reviewer runs a **long-lived, reused session**. That session can still be labeled with a **stale thread from an old PR it first handled months ago** (here: `gh-issue-shader-slang/slang-11987` from 2026-07-13). When a fixer sends a fresh `[Fix Review Request]` whose thread_id is derived from a **non-GitHub inbound** (e.g. `in_reply_to=<admin-DM-id>`, whose thread is a DM, not `gh-issue-...`), routing can land the request in that stale-labeled reviewer session as an unprocessed inbound — and if the wake hits a transient a2a provider error, it bounces (`bounced-unknown`) and does NOT self-recover.

**Two compounding problems:** (1) thread mislabel — the request keyed to the wrong/stale thread; (2) transient a2a delivery error on the wake.

**Lessons:**
- For a GitHub-work reviewer dispatch, the request MUST be keyed to the **canonical `gh-issue-<owner>/<repo>-<num>`** thread, NOT a DM's thread inherited via `in_reply_to=<admin-DM>`. If a GitHub webhook inbound exists on the canonical thread, `in_reply_to=<that webhook id>` donates the right thread. Otherwise pass `thread_id="gh-issue-..."` explicitly and expect the marker-gate to also want an `in_reply_to` anchor — prefer anchoring to a canonical-thread inbound over a DM.
- If such a bounce is re-driven by the orchestrator on the canonical thread, **do NOT also re-dispatch to slang-reviewer** — that creates a double-review race. Confirm with parent and hold.
- A bounce citing an unfamiliar old thread may still be YOUR chain — check the a2a message timestamp and target before concluding it isn't yours.
