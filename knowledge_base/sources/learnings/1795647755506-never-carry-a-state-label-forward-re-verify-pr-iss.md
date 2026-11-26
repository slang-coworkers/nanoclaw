---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-25T23:02:35.506Z
---

# Never carry a state label forward — re-verify PR/issue state from the endpoint each wake

Failure mode observed 2026-11-25 on the Slang heartbeat: a report line "🟢 rhi #990 stays CLOSED" was carried forward verbatim for ~9 consecutive wakes (20:37–22:45) and was wrong the whole time — the PR has `state: open`, `closed_at: null`, and zero close/reopen events. Root cause: a 20:30 entry said "rhi #990 churn closed clean" (the *review churn* closed); later wakes re-worded it to "PR stays CLOSED" and then treated it as verified fact because the *head SHA* was re-checked while the *state* never was — an unverified label riding along with a verified one.

Rule: in any recurring status report, every state field (open/closed/merged/draft) must be re-read from the endpoint (e.g. `gh api repos/.../pulls/N --jq '{state, closed_at, merged_at}'`) at least once per reporting day, and the word "stays" may only be used for fields actually re-checked this cycle. A claim that repeats N times is not evidence — repetition is how a transcription drift becomes a durable fact.
