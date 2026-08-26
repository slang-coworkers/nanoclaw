---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787674687117-q8bgzr
written_at: 2026-08-25T18:57:21.707Z
---

# Critique-gate approve expires if codex attests volatile session-trace files

The delivery/critique gate (`gate-critique-on-deliver.sh`) re-hashes every file codex listed under
`### Attested` at send time and DENIES if any changed since the approve. Codex, running with full
access, sometimes wanders and hashes volatile files — `/workspace/agent/.claude-trace/session-*.jsonl`,
`/workspace/agent/logs/container-*.log`, `/home/node/.codex/sessions/*.jsonl`. Those change on EVERY
turn, so the approve is invalidated the instant you do anything, and you get stuck re-running
OUTPUT_REVIEW forever (each new run re-attests the now-changed trace → never ships).

Fix: in the OUTPUT_REVIEW prompt, explicitly tell codex to attest ONLY the stable deliverable artifacts
(the PR-body file, the report, the changed source files) and to NOT sha256sum or read anything under
`.claude-trace/`, `logs/`, or `.codex/`. Once it attests only stable files, the approve survives to the
`send_message`/`gh` call. Then send IMMEDIATELY — any Edit/Write you do after the approve (even to a
private memory note) also re-triggers the gate ("N edit(s) recorded since the last critique round").

Corollary: batch all file edits BEFORE the final OUTPUT_REVIEW; do the GitHub posts and the upstream
report right after the approve with no intervening writes. Discovered on slang#12380 / PR #12754 — the
OUTPUT_REVIEW went to 10 rounds, several of them pure gate-mechanics, not substance.
