---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786605051479-olbflp
written_at: 2026-08-24T14:54:39.256Z
---

# [approver/correction] record_decision is first-write-wins (stale row can't be re-recorded) + human verdict is host-joined automatically (no record_human_verdict, nothing to capture)

**Corrects two mechanism errors in my #11387 R2 handling and in my earlier correction atom, both verified against the HOST SOURCE `/app/src/mcp-tools/core.ts` (read directly, not from memory):**

**1. `record_decision` is APPEND-ONLY, one row per (repo,pr,commit_sha), FIRST WRITE WINS.** The tool description states it verbatim: "Repeating an identical decision is a harmless no-op; a DIFFERENT decision for the same commit is refused." The handler just writes a message-out and returns a GENERIC `ok("Decision recorded: …")` BEFORE the host processes it. ⇒ **You cannot "re-record a corrected challenger" for a commit you already recorded — the later append is a no-op, the FIRST row stays operative.** If your first append carried wrong challenger prose (mine wrongly said "HUMAN VERDICT JOIN / AGREES / agreement"), the stale text is the ledger of record; the corrected rationale lives only in the workspace `decision.md`, and the report must DISCLOSE the stale operative row and flag it for host-side repair — never claim "corrected ledger" or "backfill if no row" (the row exists; it's just wrong). "The tool returned 'Decision recorded'" is NOT proof the corrected text landed — for an existing key it never can. **Rule: get the challenger text RIGHT on the first `record_decision` call for a commit; there is no edit.**

**2. The human review verdict is JOINED AUTOMATICALLY host-side; there is nothing for the approver to capture or re-attempt.** `record_human_verdict` is **deliberately NOT registered** (host comment: "The human review outcome is stamped host-side from the GitHub webhook that observed it (notifyApproverOfTerminalPr), keyed by the delivery id; the host guard denies the container-originated action"). The `record_decision` description also says: "The human review outcome is joined automatically by the host from GitHub, so there is nothing for you to report about it." ⇒ **When a human review lands on a PR you decided, do NOT write "captured via append_learning / re-attempt the join / join on merge" as if YOU perform the join — you don't. The host does it.** An `append_learning` is still worth writing for the *calibration lesson*, but it is not "the join."

**3. Minor: the "ABSTAIN_POLICY rows are EXCLUDED from agreement scoring" rule is at `SKILL.md:142`** (I cited :143). And per that rule, an ABSTAIN matching a human CHANGES_REQUESTED is **corroboration, scoring N/A** — never a scored "agreement."

All three were caught by the OUTPUT_REVIEW critique gate reading the host source. The #11387 R2 decision (ABSTAIN_POLICY:OPEN_GAP) was correct throughout; only these ledger/join mechanism claims were wrong.
