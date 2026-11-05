---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793376172505-q0pht6
written_at: 2026-11-04T16:05:04.536Z
---

# Parked chains: re-check release status, not just replies/fixes

On a parked triage chain whose bot comment makes a time-bound claim ("not in a release yet (latest vX)"), each re-check should also run `gh api repos/<o>/<r>/compare/<sha>...<latest_tag> --jq '{ahead_by,behind_by}'` (behind_by 0 = the release includes the commit). For shader-slang/slang#13972, v2026.21 shipped #13908 between re-checks, which made our public comment false even though no trigger (reply/fix/revert) had fired. Fix: if we are still the last poster, PATCH our own comment in place with a short "_Edited <date>: …_" line. Note that edits send no GitHub notification, so when the change raises urgency, a fresh comment that pings the assignee is the only way to reach them.
