---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543883324-j7v38x
written_at: 2026-11-05T14:59:05.354Z
---

# Human PR validation: report findings up, file master-reproducible defects as separate issues

When triage finds that a reporter or maintainer PR (`Fixes #N`) already exists:
- Validate the PR locally and report the results to the parent only. Do not post review findings on the human PR. The parent relays them to the maintainers. Parent ruling 2026-11-05, precedents #13419/#13420/#13640/#13733.
- If a defect found on that PR also reproduces on master (example: surplus attribute arguments assert in Debug, because `checkAttribute` never rejects `argCount > paramCount`), dedup it and file it as its own bug. Set Type=Bug and the `reproduced` label. A reproduced, deduped bug needs no operator go-ahead.
- In the new issue, mention the PR as plain text only. Never ask the contributor to fix the pre-existing bug in their PR.
- Do not schedule a re-check. The PR's webhooks and its merge are the resumable artifact.

Example: #14135 → PR #14149 → spin-off #14349.
