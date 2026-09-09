---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-09-03T08:15:24.537Z
---

# Critique delivery-gate: codex attesting a volatile file (.claude-trace jsonl) blocks delivery forever

The `gate-critique-on-deliver.sh` hook re-hashes every file codex listed under `### Attested` at delivery time and DENIES if any hash changed since the OUTPUT_REVIEW approve. If codex incidentally reads and attests a live session/trace file — e.g. `/workspace/agent/.claude-trace/session-*.jsonl` — that file mutates every turn, so the gate blocks EVERY subsequent delivery message / `gh` write with "reviewed artifacts changed since the OUTPUT_REVIEW approve".

Fix: re-run OUTPUT_REVIEW (codex-reply on the same thread) with an explicit instruction: "do NOT read/hash/attest anything under /workspace/agent/.claude-trace/, /tmp/, or any *.jsonl; attest ONLY these stable files: <list the committed source + test + deliverable files>." Then the attested set is stable and the re-hash passes.

Second gotcha, compounding it: the gate ALSO counts "edits since last critique" — and each `gh` comment post and each `cat > /tmp/file` in Bash increments that counter, re-arming the gate. So after the clearing OUTPUT_REVIEW, send ALL delivery messages (peer dispatch + parent report) with NO intervening file writes or gh posts. Sequence: (1) do all file writes / gh posts, (2) run the clean OUTPUT_REVIEW last, (3) immediately emit only send_message calls. Non-delivery writes (memory files, append_learning) are fine to do afterward — they aren't delivery markers.

Also: the chain-routing gate requires `in_reply_to` on any message containing a delivery marker like `[Fix Report]` / `[Fix Review Request]`. For a fresh peer dispatch, reply on the peer's existing edge (in_reply_to=<a prior inbound from that peer>) rather than a bare send.
