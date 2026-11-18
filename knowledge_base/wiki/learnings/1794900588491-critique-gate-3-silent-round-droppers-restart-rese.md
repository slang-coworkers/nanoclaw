---
title: "critique-gate: 3 silent round-droppers (restart reset, STAGE-in-reply, unanchored REQUIREMENTS URL)"
type: learning
topic: agent-ops
source: learnings/1794900588491-critique-gate-3-silent-round-droppers-restart-rese.md
---

# critique-gate: 3 silent round-droppers (restart reset, STAGE-in-reply, unanchored REQUIREMENTS URL)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794892206913-t1ahrc
written_at: 2026-11-17T07:29:48.491Z
---

# critique-gate: 3 silent round-droppers (restart reset, STAGE-in-reply, unanchored REQUIREMENTS URL)

Critique-gate recording mechanics (slang-fixer, 2026-11-17, issue #13618): three ways a completed critique round silently fails to record host-side, each costing a full re-review cycle to discover.

1. **A session restart wipes the recorded stages.** `workflow-state-reset.sh` (UserPromptSubmit hook) fully resets `/workspace/.claude/workflow-state.json` (including `critique_stages`) whenever a task is re-routed — provider-429 restarts re-deliver the router envelope, so every restart lost the already-approved rounds. After any session restart mid-task, expect to re-run all required stages.
2. **`codex-reply` with `STAGE:` in the prompt is DROPPED, not recorded.** The pinning gate in `track-critique.sh` requires the canonical reviewer developer-instructions, which only the initial `mcp__codex__codex` call carries; a reply that starts with `STAGE: X` parses a stage, fails pinning, and exits without recording (and replies without a STAGE marker record only as anonymous rounds — no stage credit). Corollary: NEVER put `STAGE:` in a codex-reply prompt; and a reply can never un-drop itself — each required stage needs a FRESH `mcp__codex__codex` call with STAGE + canonical developerInstructions + REQUIREMENTS.
3. **The REQUIREMENTS URL must carry an anchor.** The hook's regex requires `#(issuecomment-|discussion_r-|pullrequestreview-|issue-)<digits>`; citing the bare issue URL `https://github.com/owner/repo/issues/N` fails REQ_OK and the round is silently unrecorded even though codex itself ran and approved.

Also: the gate re-hashes the reviewer-attested artifact paths at delivery time — never edit attested files after an approve (write PR-description updates to a NEW file, e.g. to append the bot disclaimer the upsert script NOTEs about).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794900588491-critique-gate-3-silent-round-droppers-restart-rese.md`_
