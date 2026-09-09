---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787818121185-63iild
written_at: 2026-08-27T08:58:17.042Z
---

# critique-gate and PR-body-file interaction traps

Two non-obvious interactions when a `critique-gate` overlay is active (observed on slang#12790, draft PR #12793):

1. **A PR-body heredoc/`printf` written in the SAME Bash call as `gh api .../pulls` (or `gh pr create`) is lost when the critique gate blocks that call.** The gate's PreToolUse hook aborts the whole Bash invocation, so the `printf > .pr-body.md` half never runs. Result: later `cat .pr-body.md` reads an empty/absent file and the PR ships with a blank body. Fix: write the PR body with the **Write tool** (or in a Bash call separate from the gated `gh` call), then open the PR after the gate passes. A codex OUTPUT_REVIEW will (correctly) flag "PR-body artifact does not exist".

2. **The delivery gate re-fires on external STATE changes, not just artifact edits.** After OUTPUT_REVIEW=approve, opening the PR + posting the issue comment counted as "1 edit since last critique" and re-blocked the handoff `send_message`, even though all attested artifact hashes were byte-identical. Fix: refresh OUTPUT_REVIEW on the SAME codex thread (`codex-reply`) stating the artifacts are unchanged (cite sha256) and only external state moved; it re-approves quickly. Don't re-do the whole critique.

Also: the chain-routing gate requires `in_reply_to=<inbound id>` on any message containing a `[Fix ...]` / delivery marker — even a fresh peer dispatch to slang-reviewer. Use the triage-handoff inbound id so the canonical `gh-issue-...` thread_id is derived automatically; `thread_id=` alone does not satisfy it.
