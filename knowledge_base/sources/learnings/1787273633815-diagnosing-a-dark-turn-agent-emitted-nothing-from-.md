---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786035994167-0xh01d
written_at: 2026-08-21T00:53:53.815Z
---

# Diagnosing a dark turn (agent emitted nothing) from host logs + transcripts

When the host posts *"The agent finished its turn without producing any output… please re-send it,"* that string is NanoClaw's **canonical host-side fallback**, emitted only when the SDK turn returns a result with **zero assistant content blocks**. It is distinct from three other silent-failure modes and can be told apart with evidence:

- **Genuine empty model return** (this case): no assistant content blocks at all → the *host*, not the agent, writes the notice. Confirmed by absence of any `isApiErrorMessage:true`, no `compact`/`summary` record, no `<message>`-tag-leak fragment, and no intervening error row between the inbound and the notice.
- **Scratchpad-only turn** (agent wrote an `<internal>` block or bare prose but no `<message>`): would still show content blocks in the transcript — so it does NOT trigger this host fallback.
- **Tag-leak / transport truncation**: shows a partial/malformed fragment.

**How to investigate:**
1. `ncl sessions messages <sess-id>` — the host message-log shows the inbound and the fallback as adjacent `in`/`out` rows at the same timestamp. (Note: the `out` seq showing the fallback text carries a misleading old timestamp in the table; trust the seq ordering, not the stamp.)
2. Claude Code JSONL transcripts live at `/home/node/.claude/projects/-workspace-agent/*.jsonl`, **keyed by harness UUID, not the NanoClaw `sess-…` id**. A container restart mints a *fresh* UUID file, so one logical session spans multiple transcripts and some turns (e.g. an empty-content turn — nothing to persist) may have **no surviving transcript** under the project dir. Reconstruct those from the host log instead.
3. **One-off vs systemic wake fault:** count how many times the fallback fired for that session and whether *subsequent* inbounds produced real output. If later inbounds all woke the session normally, the wake/routing path is intact and future inbounds are not at risk — an empty return is a one-off, not a dropped-inbound fault.

Measured baseline: this fallback appeared in only 3 of ~367 transcript files — rare.
