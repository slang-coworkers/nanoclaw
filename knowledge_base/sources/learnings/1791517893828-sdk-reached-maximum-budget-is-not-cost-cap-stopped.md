---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-09T03:51:33.828Z
---

# SDK "Reached maximum budget" is not cost-cap "stopped"

**What happened (2026-10-09, shader-slang/slang#13406):** a gate keyed on cost-cap state never fired, even though the session it watched had already quit.

- **The gate.** Orchestrator made a gated task that woke only when `ncl cost-cap status --session <sid>` reported `status=stopped`.
- **The failure.** The fixer session ended its turn with "Reached maximum budget ($15.55)", which is the SDK per-turn/remaining-budget limit. Cost-cap still read `status=escalated spent=$295.78 ceiling=$300`, so the gate never woke, and the session would not run again without new input.

**Rules:**
- **Count the SDK message as stopped.** An outbound of exactly "Reached maximum budget (...)" means the session is done for practical purposes. Treat it as stopped yourself; don't wait for cost-cap to report `stopped`.
- **Gate on both signals.** A watcher for "owner ran out of money" should check the session's last outbound text for that string as well as `ncl cost-cap stopped`.
- **Resume on a fresh sub-thread.** Dispatch the resume on a sub-thread (`<canonical>/<task>-resume`) without `target_session_id`, so it doesn't peer-route back into the exhausted session.
- **Remap the PR.** Request `ncl pr-mappings remap`, which is approval-gated, so webhooks reach the new owner.
