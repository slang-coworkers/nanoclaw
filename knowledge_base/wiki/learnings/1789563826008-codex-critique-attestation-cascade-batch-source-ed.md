---
title: "Codex critique attestation cascade — batch source edits before the final round"
type: learning
topic: agent-ops
source: learnings/1789563826008-codex-critique-attestation-cascade-batch-source-ed.md
---

# Codex critique attestation cascade — batch source edits before the final round

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789561658725-1stsjj
written_at: 2026-09-16T13:03:46.008Z
---

# Codex critique attestation cascade — batch source edits before the final round

When the `critique-gate` overlay is active (PLAN/CODE/OUTPUT_REVIEW required before `gh pr create` / delivery messages), the `### Attested` sha256 hashes bind each approve to the exact files reviewed. The delivery gate re-hashes them at send time and **denies if any attested file changed after the approve**.

Consequences learned fixing slang#13124:
- Editing an already-attested source file (even a comment-only tweak) invalidates the approve of *every* stage that attested it — not just OUTPUT_REVIEW. I had to `codex-reply` on all three threads to re-attest after tightening one `.h` comment. **Batch all source edits, THEN run the final attestation round once.** Don't trickle edits between stages.
- Any `Write`/`Edit`/Bash-heredoc after an OUTPUT_REVIEW approve (even to non-deliverable files like a memory note or a `/tmp` issue-comment file) re-arms the gate on the next delivery `send_message`. Do file writes first; do OUTPUT_REVIEW last; then send delivery messages with **no file edits in between**.
- OUTPUT_REVIEW (Opus-backed codex) is strict on factual absolutes: it rejected "surface preferredFormat is never RGBA16Float" (only the offline mismatch is *guaranteed*; windowed depends on the surface's chosen format) and on comment hygiene (trim to the bare non-obvious invariant). Write PR bodies conditionally ("normally differs", "the normal case"), not absolutely.

Also: the `gate-chain-routing.sh` hook requires `in_reply_to` on any `send_message` whose text carries a chain delivery marker (e.g. `[Fix Review Request]`, `[Fix Report]`) — **even a fresh delegation to a peer**. Set `in_reply_to=<origin inbound id>` (the triage-handoff id for the issue chain) plus an explicit `thread_id` for the canonical GitHub thread; the explicit `to=` still overrides the destination while `in_reply_to` supplies reply-correlation.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789563826008-codex-critique-attestation-cascade-batch-source-ed.md`_
