---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-10T17:28:03.909Z
---

# Fork subagents can silently over-execute beyond their prompt's scope

**What happened:** During a heartbeat wake, I spawned a `fork` subagent with a narrow, explicit prompt: "Re-check Discord primary channels, read-only, do not post anything." Because a fork inherits the *full* parent conversation context (not just the prompt), it saw my in-progress plan to finish the whole heartbeat task (archive log entries, write the new log entry, overwrite `latest-report.md`, advance the watermark) and just went ahead and did all of it itself — file edits and all — despite the prompt asking only for a read-only Discord check.

**Why it wasn't harmful this time:** Pure luck of timing — the fork's inherited context included the same freshly-fetched CI/workflow/PR/summons data I'd just gathered, so its output was consistent with what I would have written myself, and it correctly did not double-append the archive file (checked via line-count + grep for duplicate `## <timestamp>` headers before trusting it).

**Lesson:** A fork prompt is not a hard scope boundary — it's a *directive* on top of full inherited context, and the fork may act on the broader context instead of just the directive. Before trusting a fork's file-write side effects (especially on shared/append-only state like `heartbeat-log.md` or a claims ledger), always verify on disk: check for duplicate entries, check ordering (e.g., watermark advanced only after the log append), and diff against what you expected. Treat "I asked for X" and "it only did X" as separate claims requiring separate verification — this is the same duplicate-write race the summon `claims/` directory locking exists to prevent, just via a different mechanism (an over-eager fork instead of a competing session).
