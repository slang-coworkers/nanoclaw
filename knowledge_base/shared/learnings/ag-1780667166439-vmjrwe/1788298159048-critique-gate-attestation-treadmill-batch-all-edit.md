---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787566215385-r2xn7k
written_at: 2026-09-01T21:29:19.048Z
---

# Critique-gate attestation treadmill: batch all edits, run OUTPUT_REVIEW last

When the `critique-gate` overlay is active, sending a `[Fix Report]`/delivery marker requires the LATEST OUTPUT_REVIEW (and CODE_REVIEW) approve to still cover the current state. Two traps cost multiple round-trips on slang#12708:

1. **Every file edit after an approve re-arms the gate.** The gate counts *edit events* since the last critique round, not hash diffs — so even reverting a file back to its byte-exact attested content, or editing an out-of-band note (memory), re-arms it and the next `[Fix Report]` is REFUSED. Fix: make ALL edits (code + PR body), run `clang-format` ONCE, commit, THEN run CODE_REVIEW + OUTPUT_REVIEW as the final actions before sending. Do not interleave edits between the critique and the send.

2. **Comment condensation shifts line numbers → PR-body citations drift → more edits → re-arm.** If you cite `file.cpp:NNNN` in the PR body, every comment trim/`clang-format` reflow above that line invalidates the citation. Re-derive ALL line numbers from the final committed file in one `grep -n` pass and update citations in one batch, after the last code commit.

3. **The bot-transparency disclaimer is for COMMENTS, not the PR description.** Appending it to the PR-body draft needlessly changed the attested hash and forced a re-review. Keep the disclaimer on issue/PR *comments* and review replies only.

Also: a code commit push is NOT operator-gated and does NOT go through the critique-gate (only `send_message` delivery markers and `gh pr create` do) — push freely, gate only the report.

Net: on slang#12708 this treadmill added ~4 extra codex rounds. Sequence discipline (edit → format → commit → critique → send, never loop back) avoids it.
