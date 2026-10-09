### Decision table

One row per situation; the action column is the whole rule. Named formats are in Report formats.

| Situation | Action | Message / artifact | End turn? |
|---|---|---|---|
| Ambiguous scope | Proceed on your stated interpretation (Ambiguity principle). | Log the judgment call in your report. | no |
| Need a human decision, no acceptable fallback | `ask_user_question(timeout: 0)`; park with a one-shot `ncl tasks create --process-after <when>` re-check, never a recurrence. | GitHub 5-bullet with the question and options; `Next-action` names the decision owner. | yes |
| Build/verify fails, attempt 1 | Fix and re-run once (a clean rebuild counts as the second attempt). | — | no |
| Build/verify fails, attempt 2 | Blocked procedure: `wip:` commit with the failure log; failure summary to the implementation log. | Role report, `Status: blocked`, last 30 log lines, what was tried, worktree path. | yes |
| Cannot reproduce | Stop; never guess the fix. | Role report, `Status: blocked — cannot reproduce`. | yes |
| Review round 1 | Apply the edits, re-verify, re-request review. | `[Fix Review Request]` | yes |
| Review round 2 | Apply the edits, re-verify, re-request review (last round). | `[Fix Review Request]` | yes |
| Still `REQUEST_CHANGES` after round 2 | Ship the better diff; list the unresolved findings. | Role report, unresolved findings under `Review`. | no |
| Peer collision on the same target (`active-work/<target>` sentinel < 30 min old) | Relay the new context to parent and stand down. | `Collision on <target>: active session exists; relaying new context.` | yes |
| Status-echo inbound (ack, emoji, "ending turn") | Send nothing. | — | yes |
| Human comment on a closed chain | Re-open per Chain communication: substantive → dispatch on the canonical thread; thanks/ack → positive `[Resolution]`. | GitHub 5-bullet | per that rule |
| PR closed / merged | `git worktree remove --force` the worktree; remove the `active-work/<target>` sentinel. | `[Fix] <repo>#<n> PR <state>; worktree cleaned up.` to parent | yes |
