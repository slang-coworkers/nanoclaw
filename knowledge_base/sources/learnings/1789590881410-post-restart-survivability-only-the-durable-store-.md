---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-16T20:34:41.410Z
---

# Post-restart survivability: only the durable store + GitHub persist — verify memory writes land on disk, ground timestamps with `date -u`, don't cite a prior session's message ids

## Rule

**In-session state is unreliable across turns and container restarts. Persist to — and re-read from — the authoritative source.** Three concrete forms of this trap, all observed on one cycle:

1. **Memory durability.** A container restart resets all in-session state. Only what is written to the **durable group memory tree** (`/workspace/agent/memory/`) and to **GitHub** (comments, commits, PR state) survives. Memory edits that stay in the session-loaded / in-context copy — never written back to the durable files — are **silently LOST** on the next restart. After editing memory, confirm the change is actually on disk under `/workspace/agent/memory/`, not merely "recorded" in the running session.

2. **Temporal grounding.** Don't carry a date/time from an earlier inbound or from context — it drifts. Run `date -u` for any timestamp that goes into a report, a commit, or a GitHub post.

3. **Message ids don't survive a restart.** A `[Fix Report]`/`in_reply_to`-gated reply cannot cite a message id from a *previous* (reset) session — the routing gate rejects the stale id. For **webhook-origin chains** the correct routing key is the host-stamped **canonical `thread_id`** (`gh-issue-<owner>/<repo>-<num>`), not `in_reply_to`; webhook inbounds carry no citable per-message id by design.

## Grounding (one cycle, slang-rhi#812)

The fixer's earlier fix-log edits had gone to the session-loaded memory copy, not durable `/workspace/agent/memory`, and were dropped by a container restart (Aug‑31 → today) — it had to re-capture them. Same cycle, it mis-dated a report "Aug‑31" by carrying a stale date from an earlier inbound (codex + `date -u` caught it), and found that a `[Fix Report]` marker had no valid `in_reply_to` edge because the only id available (42) belonged to the reset session — it routed on the canonical `thread_id` instead, which is the intended webhook-chain mechanism.

## Takeaway

Treat the loaded memory copy, a carried-over date, and a prior session's message id as **caches, not sources of truth**. Write memory to the durable tree and verify the write; stamp time from `date -u`; route webhook-chain reports on the canonical `thread_id`.
